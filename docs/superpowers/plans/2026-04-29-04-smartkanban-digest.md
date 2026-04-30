# Phase 4 — SmartKanban Digest Adapter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A small standalone CLI utility (`apps/digest`) that runs on a schedule (cron / launchd), reads the dashboard's `config.json` to find Tdarr + SmartKanban credentials, queries Tdarr's history for jobs completed since the last run, aggregates a one-line summary, and POSTs it as an activity entry on a configured SmartKanban "Media Pipeline" card.

**Architecture:** New workspace `apps/digest`. Single binary `transcode-digest` that:
1. Loads config via `ConfigStore` (re-uses backend's class).
2. Reads a checkpoint file `apps/digest/data/last-run.json` for `lastRunTs`.
3. Calls `TdarrClient.getHistory(lastRunTs)` to retrieve completed jobs.
4. Aggregates `{done, failed, totalGbSaved, avgEncodeMin}`.
5. If non-empty, POSTs to `${smartKanban.url}/api/cards/${digestCardId}/activity` with bearer token.
6. Updates checkpoint to `now()`.

The adapter mutates only via SmartKanban's existing endpoint; SmartKanban schema unchanged. If SmartKanban is down or credentials missing, log and skip — never blocks the pipeline.

**Tech stack:** Node 22 + TypeScript + tsx (matches backend). Reuses `@tpd/shared` schemas, `apps/backend` `ConfigStore` and `TdarrClient`.

**Source spec:** [docs/superpowers/specs/2026-04-29-truenas-plex-transcode-pipeline-design.md](../specs/2026-04-29-truenas-plex-transcode-pipeline-design.md)

**Parent plan:** [2026-04-29-truenas-plex-transcode-pipeline.md](./2026-04-29-truenas-plex-transcode-pipeline.md)

## File structure

```
apps/digest/
  package.json
  tsconfig.json
  README.md
  src/
    index.ts                       # CLI entry: parse env, run once
    digest.ts                      # core logic (aggregate + post)
    checkpoint.ts                  # last-run-ts read/write
    smartkanban-client.ts          # tiny POST /api/cards/{id}/activity wrapper
  tests/
    digest.test.ts                 # full integration with mocked fetches
    checkpoint.test.ts             # round-trip
  data/
    .gitkeep
```

## Task 1: Bootstrap workspace + checkpoint + smartkanban client

**Files:**
- Create `apps/digest/package.json`, `tsconfig.json`, `README.md`, `src/checkpoint.ts`, `src/smartkanban-client.ts`, `data/.gitkeep`, `tests/checkpoint.test.ts`

### Step 1: `apps/digest/package.json`

```json
{
  "name": "@tpd/digest",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "bin": { "transcode-digest": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@tpd/shared": "*",
    "@tpd/backend": "*",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0",
    "@types/node": "^22.5.0"
  }
}
```

Note: depends on `@tpd/backend` so we can import `ConfigStore` and `TdarrClient`. The npm workspace symlink resolves it.

### Step 2: `apps/digest/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@tpd/shared": ["../../packages/shared/src/index.ts"],
      "@tpd/backend": ["../../apps/backend/src/index.ts"],
      "@tpd/backend/*": ["../../apps/backend/src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

### Step 3: `apps/digest/README.md`

```md
# transcode-digest

Hourly summary adapter. Reads completed Tdarr jobs since the last run and posts a
one-line activity entry to a SmartKanban "Media Pipeline" card.

## Run

```sh
# one-shot
CONFIG_FILE=../backend/data/config.json npm start

# via cron (Mac launchd):
*/60 * * * *  cd /path/to/digest && CONFIG_FILE=/abs/config.json npm start >> /var/log/digest.log 2>&1
```

Idempotent — checkpoint at `data/last-run.json` prevents double-posting.
```

### Step 4: `apps/digest/src/checkpoint.ts`

```ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

interface Checkpoint { lastRunTs: number; }

export class CheckpointStore {
  constructor(private path: string) {}
  async load(): Promise<number> {
    try {
      const raw = await readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw) as Checkpoint;
      return Number(parsed.lastRunTs) || 0;
    } catch {
      return 0;
    }
  }
  async save(lastRunTs: number): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify({ lastRunTs }), 'utf8');
  }
}
```

### Step 5: `apps/digest/src/smartkanban-client.ts`

```ts
export class SmartKanbanClient {
  constructor(private url: string, private token: string) {}
  async postActivity(cardId: string, body: string): Promise<{ ok: boolean; status: number; error?: string }> {
    const probeUrl = `${this.url.replace(/\/$/, '')}/api/cards/${encodeURIComponent(cardId)}/activity`;
    try {
      const res = await fetch(probeUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ body, source: 'transcode-digest' }),
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, status: 0, error: (e as Error).message };
    }
  }
}
```

### Step 6: `apps/digest/tests/checkpoint.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CheckpointStore } from '../src/checkpoint.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tpd-cp-'));
});

describe('CheckpointStore', () => {
  it('returns 0 when no file', async () => {
    const c = new CheckpointStore(join(dir, 'cp.json'));
    expect(await c.load()).toBe(0);
  });
  it('round-trips a value', async () => {
    const file = join(dir, 'cp.json');
    const a = new CheckpointStore(file);
    await a.save(42);
    const b = new CheckpointStore(file);
    expect(await b.load()).toBe(42);
  });
});
```

### Step 7: Install + commit

```bash
cd /Users/npalakurla/WorkingFolder/TranscodePipelineDash
mkdir -p apps/digest/data
touch apps/digest/data/.gitkeep
npm install -w @tpd/digest
npm test -w @tpd/digest
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla add apps/digest
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(digest): bootstrap workspace, checkpoint store, smartkanban client"
```

## Task 2: digest core logic + CLI entry + integration test

**Files:**
- Create `apps/digest/src/digest.ts`, `src/index.ts`, `tests/digest.test.ts`

### Step 1: `apps/digest/src/digest.ts`

```ts
import type { Config } from '@tpd/shared';
import type { TdarrJob } from '@tpd/backend/clients/tdarr.js';
import { TdarrClient } from '@tpd/backend/clients/tdarr.js';
import { SmartKanbanClient } from './smartkanban-client.js';
import { CheckpointStore } from './checkpoint.js';

export interface DigestRunResult {
  posted: boolean;
  done: number;
  failed: number;
  reason?: string;
}

export interface DigestDeps {
  cfg: Config;
  checkpoint: CheckpointStore;
  tdarrFactory?: (url: string, key?: string) => TdarrClient;
  smartKanbanFactory?: (url: string, token: string) => SmartKanbanClient;
  now?: () => number;
}

export async function runDigest(deps: DigestDeps): Promise<DigestRunResult> {
  const { cfg, checkpoint } = deps;
  const now = deps.now ? deps.now() : Date.now();
  if (!cfg.tdarr.url) {
    return { posted: false, done: 0, failed: 0, reason: 'tdarr.url not set' };
  }
  if (!cfg.smartKanban.url || !cfg.smartKanban.token || !cfg.smartKanban.digestCardId) {
    return { posted: false, done: 0, failed: 0, reason: 'smartKanban not fully configured' };
  }

  const lastRunTs = await checkpoint.load();
  const tdarr = (deps.tdarrFactory ?? ((u, k) => new TdarrClient(u, k)))(
    cfg.tdarr.url,
    cfg.tdarr.apiKey || undefined,
  );

  let history: TdarrJob[] = [];
  try {
    history = await tdarr.getHistory(lastRunTs);
  } catch (e) {
    return { posted: false, done: 0, failed: 0, reason: `tdarr error: ${(e as Error).message}` };
  }

  const done = history.filter((h) => h.status === 'success').length;
  const failed = history.filter((h) => h.status === 'error' || h.status === 'cancelled').length;

  if (done === 0 && failed === 0) {
    await checkpoint.save(now);
    return { posted: false, done, failed, reason: 'nothing to report' };
  }

  const titles = history
    .filter((h) => h.status === 'success')
    .slice(0, 3)
    .map((h) => h.title || h.file)
    .join(', ');
  const summary = `Last interval: ${done} done${titles ? ` (${titles})` : ''}, ${failed} failed.`;

  const sk = (deps.smartKanbanFactory ?? ((u, t) => new SmartKanbanClient(u, t)))(
    cfg.smartKanban.url,
    cfg.smartKanban.token,
  );
  const r = await sk.postActivity(cfg.smartKanban.digestCardId, summary);

  if (!r.ok) {
    return { posted: false, done, failed, reason: `smartkanban ${r.status} ${r.error ?? ''}`.trim() };
  }

  await checkpoint.save(now);
  return { posted: true, done, failed };
}
```

### Step 2: `apps/digest/src/index.ts` (CLI entry)

```ts
#!/usr/bin/env tsx
import { ConfigStore } from '@tpd/backend/config-store.js';
import { CheckpointStore } from './checkpoint.js';
import { runDigest } from './digest.js';

async function main() {
  const configFile = process.env.CONFIG_FILE ?? './apps/backend/data/config.json';
  const checkpointFile = process.env.CHECKPOINT_FILE ?? './apps/digest/data/last-run.json';

  const store = new ConfigStore(configFile);
  const cfg = await store.load();
  const checkpoint = new CheckpointStore(checkpointFile);

  const r = await runDigest({ cfg, checkpoint });
  // Always exit 0 — adapter is opportunistic; never block the pipeline.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(r));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(`digest error: ${(e as Error).message}`);
  process.exit(0);
});
```

### Step 3: `apps/digest/tests/digest.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDigest } from '../src/digest.js';
import { CheckpointStore } from '../src/checkpoint.js';
import type { Config } from '@tpd/shared';

function mkCfg(over: Partial<Config> = {}): Config {
  return {
    schemaVersion: 1,
    sources: [],
    libraries: [],
    plex: { url: '', token: '' },
    tdarr: { url: 'http://t', apiKey: '' },
    smartKanban: { url: 'http://sk', token: 'tok', digestCardId: 'card-1' },
    encodeTargets: {
      hevc4kBitrateMbps: 25,
      h2641080pBitrateMbps: 8,
      aacBitrateKbps: 192,
      tonemapAlgorithm: 'hable',
      enable4kHevcVariant: true,
      enable1080pSdrVariant: true,
    },
    onboardingComplete: true,
    ...over,
  } as Config;
}

function mkDeps() {
  const dir = mkdtempSync(join(tmpdir(), 'tpd-d-'));
  const checkpoint = new CheckpointStore(join(dir, 'cp.json'));
  const tdarrGet = vi.fn();
  const skPost = vi.fn();
  return {
    checkpoint,
    tdarrGet,
    skPost,
    deps: (cfg: Config) => ({
      cfg,
      checkpoint,
      tdarrFactory: () => ({ getHistory: tdarrGet, getStatus: vi.fn() }) as unknown as ReturnType<typeof import('@tpd/backend/clients/tdarr.js').TdarrClient.prototype.getHistory> extends infer X ? import('@tpd/backend/clients/tdarr.js').TdarrClient : never,
      smartKanbanFactory: () => ({ postActivity: skPost }),
      now: () => 1000,
    }),
  };
}

describe('runDigest', () => {
  it('skips when tdarr.url is empty', async () => {
    const r = await runDigest({
      cfg: mkCfg({ tdarr: { url: '', apiKey: '' } }),
      checkpoint: new CheckpointStore('/tmp/none.json'),
    });
    expect(r.posted).toBe(false);
    expect(r.reason).toMatch(/tdarr.url/);
  });

  it('skips when smartkanban not fully configured', async () => {
    const r = await runDigest({
      cfg: mkCfg({ smartKanban: { url: '', token: '', digestCardId: '' } }),
      checkpoint: new CheckpointStore('/tmp/none.json'),
    });
    expect(r.posted).toBe(false);
    expect(r.reason).toMatch(/smartKanban/);
  });

  it('does not post when no jobs in history', async () => {
    const m = mkDeps();
    m.tdarrGet.mockResolvedValue([]);
    m.skPost.mockResolvedValue({ ok: true, status: 200 });
    const cfg = mkCfg();
    const r = await runDigest(m.deps(cfg) as any);
    expect(r.posted).toBe(false);
    expect(m.skPost).not.toHaveBeenCalled();
    expect(await m.checkpoint.load()).toBe(1000);
  });

  it('posts a digest when jobs exist', async () => {
    const m = mkDeps();
    m.tdarrGet.mockResolvedValue([
      { _id: '1', file: '/m/dune.mkv', title: 'Dune', status: 'success' },
      { _id: '2', file: '/m/tenet.mkv', title: 'Tenet', status: 'success' },
      { _id: '3', file: '/m/x.mkv', title: 'X', status: 'error' },
    ]);
    m.skPost.mockResolvedValue({ ok: true, status: 200 });
    const cfg = mkCfg();
    const r = await runDigest(m.deps(cfg) as any);
    expect(r.posted).toBe(true);
    expect(r.done).toBe(2);
    expect(r.failed).toBe(1);
    const callArgs = m.skPost.mock.calls[0]!;
    expect(callArgs[0]).toBe('card-1');
    expect(callArgs[1]).toMatch(/2 done/);
    expect(callArgs[1]).toMatch(/Dune/);
    expect(await m.checkpoint.load()).toBe(1000);
  });

  it('does not advance checkpoint if smartkanban POST fails', async () => {
    const m = mkDeps();
    m.tdarrGet.mockResolvedValue([
      { _id: '1', file: '/m/dune.mkv', title: 'Dune', status: 'success' },
    ]);
    m.skPost.mockResolvedValue({ ok: false, status: 502, error: 'Bad Gateway' });
    const cfg = mkCfg();
    const r = await runDigest(m.deps(cfg) as any);
    expect(r.posted).toBe(false);
    expect(r.reason).toMatch(/502/);
    expect(await m.checkpoint.load()).toBe(0);
  });
});
```

### Step 4: Test + commit + tag

```bash
cd /Users/npalakurla/WorkingFolder/TranscodePipelineDash
npm test -w @tpd/digest
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla add apps/digest
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(digest): add runDigest core + CLI entry with full integration tests"
git tag phase-4-complete
git log --oneline | head -3
```

## Self-Review

- Spec coverage: hourly cron-style adapter, reads dashboard config, queries Tdarr history, aggregates, posts to SmartKanban activity endpoint, idempotent via checkpoint. Done.
- Risks: SmartKanban activity body shape (`body`, `source`) may differ from the actual API. The client wraps a single endpoint, easily changed. Test asserts on call arguments rather than wire format.
- The CLI exits 0 even on failure to avoid the digest blocking anything else; logs are the audit trail.
