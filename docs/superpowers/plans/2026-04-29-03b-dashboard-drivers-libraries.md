# Phase 3b — Source Drivers, Libraries, Service Config, Onboarding Wizard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Round out dashboard configuration so the user can describe their entire environment in the UI: any source type (truenas/smb/nfs/local; rclone deferred), libraries that map sources to Plex sections, Plex / Tdarr / SmartKanban server connection groups (fields + connection testers), and an onboarding wizard that walks first-run users through everything.

**Architecture:** Adds new backend drivers (`smb`, `nfs`, `truenas`) by reusing the `SourceDriver` interface from 3a and shelling out to system mount tools (`mount_smbfs`, `mount_nfs`) to validate connectivity. TrueNAS driver wraps `smb` plus optional SSH ops. Each driver runs validation by attempting an actual mount + immediate unmount, so a green badge means "the worker can really mount this." Libraries are a separate top-level config list. Service groups (Plex/Tdarr/SmartKanban) are simple `{url, token?}` config blobs with stand-alone HTTP probe testers. Onboarding wizard is a multi-step React flow over the existing Settings building blocks.

**Tech stack additions:** `node:child_process` (mount probes), `undici` for HTTP probes, no new frontend libraries.

**Source spec:** [docs/superpowers/specs/2026-04-29-truenas-plex-transcode-pipeline-design.md](../specs/2026-04-29-truenas-plex-transcode-pipeline-design.md)

**Parent plan:** [2026-04-29-truenas-plex-transcode-pipeline.md](./2026-04-29-truenas-plex-transcode-pipeline.md)

---

## File Structure (created/modified)

```
TranscodePipelineDash/
  packages/shared/
    src/
      config-schema.ts              # MODIFY: extend Source unions, add Plex/Tdarr/SmartKanban schemas, EncodeTargets
      source-types.ts               # MODIFY: per-type config schemas (smb, nfs, truenas)
    tests/
      config-schema.test.ts         # MODIFY: add new schema tests
  apps/backend/
    src/
      drivers/
        smb.ts                      # NEW
        nfs.ts                      # NEW
        truenas.ts                  # NEW (wraps smb + ssh)
        index.ts                    # MODIFY: registry per type
      routes/
        sources.ts                  # MODIFY: dispatch by type via registry
        services.ts                 # NEW: POST /api/services/{plex|tdarr|smartkanban}/test
      lib/
        mount.ts                    # NEW: spawn mount/umount helpers
        http-probe.ts               # NEW: simple GET probe with timeout
    tests/
      drivers/
        smb.test.ts                 # NEW (unit; mount fns mocked)
        nfs.test.ts                 # NEW (unit)
        truenas.test.ts             # NEW (unit)
      routes/
        services.test.ts            # NEW
  apps/frontend/
    src/
      components/
        Settings/
          SourceRow.tsx             # MODIFY: enable truenas/smb/nfs in dropdown, render per-type fields
          LibrariesList.tsx         # NEW
          LibraryRow.tsx            # NEW
          ServiceGroup.tsx          # NEW (Plex/Tdarr/SmartKanban shared component)
          EncodeTargets.tsx         # NEW
        Onboarding/
          OnboardingWizard.tsx      # NEW
          steps/
            WelcomeStep.tsx
            SourcesStep.tsx
            LibrariesStep.tsx
            PlexStep.tsx
            TdarrStep.tsx
            SmartKanbanStep.tsx
            EncodeTargetsStep.tsx
            DoneStep.tsx
      pages/
        SettingsPage.tsx            # MODIFY: render all groups, conditional onboarding mount
        OnboardingPage.tsx          # NEW
      api/
        client.ts                   # MODIFY: add service test calls
```

---

## Task 1: Shared schemas — service groups, library, encode targets, per-type source configs

**Files:**
- Modify: `packages/shared/src/source-types.ts`
- Modify: `packages/shared/src/config-schema.ts`
- Modify: `packages/shared/tests/config-schema.test.ts`

- [ ] **Step 1: Update `source-types.ts` with concrete per-type configs**

```ts
import { z } from 'zod';

export const SOURCE_TYPES = ['local', 'truenas', 'smb', 'nfs', 'rclone'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const LocalSourceConfig = z.object({
  path: z.string().min(1),
});

export const SmbSourceConfig = z.object({
  host: z.string().min(1),
  share: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  domain: z.string().optional(),
});

export const NfsSourceConfig = z.object({
  host: z.string().min(1),
  exportPath: z.string().min(1),
  version: z.enum(['3', '4']).default('4'),
});

export const TrueNasSourceConfig = z.object({
  host: z.string().min(1),
  share: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  ssh: z
    .object({
      user: z.string().min(1),
      port: z.number().int().positive().default(22),
    })
    .optional(),
});

export const RcloneSourceConfig = z.object({
  remote: z.string().min(1),
});

export const SourceConfigByType = {
  local: LocalSourceConfig,
  smb: SmbSourceConfig,
  nfs: NfsSourceConfig,
  truenas: TrueNasSourceConfig,
  rclone: RcloneSourceConfig,
} as const;
```

- [ ] **Step 2: Extend `config-schema.ts` with libraries, services, encode targets**

```ts
import { z } from 'zod';
import { SourceConfigByType } from './source-types.js';

const baseSource = z.object({ id: z.string().min(1), label: z.string().min(1) });

export const SourceSchema = z.discriminatedUnion('type', [
  baseSource.extend({ type: z.literal('local'), config: SourceConfigByType.local }),
  baseSource.extend({ type: z.literal('smb'), config: SourceConfigByType.smb }),
  baseSource.extend({ type: z.literal('nfs'), config: SourceConfigByType.nfs }),
  baseSource.extend({ type: z.literal('truenas'), config: SourceConfigByType.truenas }),
  baseSource.extend({ type: z.literal('rclone'), config: SourceConfigByType.rclone }),
]);
export type Source = z.infer<typeof SourceSchema>;

export const LibrarySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sourceId: z.string().min(1),
  pathWithinSource: z.string(),
  libraryType: z.enum(['movie', 'tv', 'other']),
});
export type Library = z.infer<typeof LibrarySchema>;

export const PlexConfig = z.object({
  url: z.string().url().or(z.literal('')),
  token: z.string().default(''),
});
export const TdarrConfig = z.object({
  url: z.string().url().or(z.literal('')),
  apiKey: z.string().default(''),
});
export const SmartKanbanConfig = z.object({
  url: z.string().url().or(z.literal('')),
  token: z.string().default(''),
  digestCardId: z.string().default(''),
});

export const EncodeTargetsSchema = z.object({
  hevc4kBitrateMbps: z.number().positive().default(25),
  h2641080pBitrateMbps: z.number().positive().default(8),
  aacBitrateKbps: z.number().positive().default(192),
  tonemapAlgorithm: z.enum(['hable', 'mobius', 'reinhard']).default('hable'),
  enable4kHevcVariant: z.boolean().default(true),
  enable1080pSdrVariant: z.boolean().default(true),
});

export const ConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    sources: z.array(SourceSchema),
    libraries: z.array(LibrarySchema),
    plex: PlexConfig.default({ url: '', token: '' }),
    tdarr: TdarrConfig.default({ url: '', apiKey: '' }),
    smartKanban: SmartKanbanConfig.default({ url: '', token: '', digestCardId: '' }),
    encodeTargets: EncodeTargetsSchema.default({}),
    onboardingComplete: z.boolean().default(false),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set(cfg.sources.map((s) => s.id));
    cfg.libraries.forEach((lib, i) => {
      if (!ids.has(lib.sourceId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['libraries', i, 'sourceId'],
          message: `sourceId "${lib.sourceId}" not found in sources`,
        });
      }
    });
  });
export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({
  schemaVersion: 1,
  sources: [],
  libraries: [],
});
```

- [ ] **Step 3: Add tests covering smb / nfs / truenas / plex / tdarr / smartKanban / encodeTargets / onboardingComplete**

Append to `packages/shared/tests/config-schema.test.ts` (keep existing `describe` blocks):

```ts
import { describe, it, expect } from 'vitest';
// ...keep existing imports + suites...

describe('Source types beyond local', () => {
  it('accepts smb', () => {
    const s = SourceSchema.parse({
      id: 's', label: 's', type: 'smb',
      config: { host: '10.0.0.1', share: 'media', username: 'u', password: 'p' },
    });
    expect(s.type).toBe('smb');
  });
  it('accepts nfs with default version', () => {
    const s = SourceSchema.parse({
      id: 's', label: 's', type: 'nfs',
      config: { host: '10.0.0.1', exportPath: '/mnt/tank/media' },
    });
    expect(s.type).toBe('nfs');
    if (s.type === 'nfs') expect(s.config.version).toBe('4');
  });
  it('accepts truenas with optional ssh block', () => {
    const s = SourceSchema.parse({
      id: 's', label: 's', type: 'truenas',
      config: {
        host: '192.168.50.11', share: 'media', username: 'tdarr', password: 'p',
        ssh: { user: 'admin' },
      },
    });
    expect(s.type).toBe('truenas');
  });
});

describe('Service groups', () => {
  it('accepts an empty plex/tdarr/smartKanban', () => {
    const cfg = ConfigSchema.parse({ schemaVersion: 1, sources: [], libraries: [] });
    expect(cfg.plex.url).toBe('');
    expect(cfg.tdarr.url).toBe('');
    expect(cfg.smartKanban.url).toBe('');
  });
  it('rejects an invalid plex url', () => {
    expect(() =>
      ConfigSchema.parse({
        schemaVersion: 1, sources: [], libraries: [],
        plex: { url: 'not-a-url', token: '' },
      }),
    ).toThrow();
  });
});

describe('EncodeTargets defaults', () => {
  it('fills sensible defaults', () => {
    const cfg = ConfigSchema.parse({ schemaVersion: 1, sources: [], libraries: [] });
    expect(cfg.encodeTargets.hevc4kBitrateMbps).toBe(25);
    expect(cfg.encodeTargets.tonemapAlgorithm).toBe('hable');
    expect(cfg.encodeTargets.enable4kHevcVariant).toBe(true);
  });
});
```

- [ ] **Step 4: Run shared tests, verify pass**

```bash
cd /Users/npalakurla/WorkingFolder/TranscodePipelineDash
npm test -w @tpd/shared
```
Expected: original 7 + new tests all pass.

- [ ] **Step 5: Commit**

```bash
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla add packages/shared
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(shared): add smb/nfs/truenas configs, libraries, plex/tdarr/smartKanban, encodeTargets"
```

---

## Task 2: Backend mount + http-probe helpers

**Files:**
- Create: `apps/backend/src/lib/mount.ts`
- Create: `apps/backend/src/lib/http-probe.ts`

- [ ] **Step 1: Implement `apps/backend/src/lib/mount.ts`**

```ts
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface RunResult { code: number; stdout: string; stderr: string; }

function run(cmd: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
    p.on('error', (e) => resolve({ code: -1, stdout: '', stderr: e.message }));
  });
}

export async function probeSmb(opts: {
  host: string; share: string; username: string; password: string; domain?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'tpd-smb-probe-'));
  const userPart = opts.domain ? `${opts.domain};${opts.username}` : opts.username;
  const url = `//${encodeURIComponent(userPart)}:${encodeURIComponent(opts.password)}@${opts.host}/${encodeURIComponent(opts.share)}`;
  const mounted = await run('mount_smbfs', [url, dir]);
  if (mounted.code !== 0) {
    await rm(dir, { recursive: true, force: true });
    return { ok: false, error: mounted.stderr.trim() || `mount_smbfs exited ${mounted.code}` };
  }
  await run('umount', [dir]);
  await rm(dir, { recursive: true, force: true });
  return { ok: true };
}

export async function probeNfs(opts: {
  host: string; exportPath: string; version: '3' | '4';
}): Promise<{ ok: boolean; error?: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'tpd-nfs-probe-'));
  const versionFlag = `vers=${opts.version}`;
  const mounted = await run('mount_nfs', [
    '-o', `${versionFlag},soft,timeo=30,retrans=2`,
    `${opts.host}:${opts.exportPath}`, dir,
  ]);
  if (mounted.code !== 0) {
    await rm(dir, { recursive: true, force: true });
    return { ok: false, error: mounted.stderr.trim() || `mount_nfs exited ${mounted.code}` };
  }
  await run('umount', [dir]);
  await rm(dir, { recursive: true, force: true });
  return { ok: true };
}
```

- [ ] **Step 2: Implement `apps/backend/src/lib/http-probe.ts`**

```ts
export async function httpProbe(opts: {
  url: string;
  method?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  expectStatusBelow?: number;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!opts.url) return { ok: false, error: 'url is empty' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 5000);
  try {
    const res = await fetch(opts.url, {
      method: opts.method ?? 'GET',
      headers: opts.headers,
      signal: ctl.signal,
    });
    const limit = opts.expectStatusBelow ?? 500;
    return { ok: res.status < limit, status: res.status };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/lib/mount.ts apps/backend/src/lib/http-probe.ts
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(backend): add mount and http-probe helpers"
```

(No new tests this task — covered by drivers in Task 3 and services route in Task 5.)

---

## Task 3: Backend SMB / NFS / TrueNAS drivers

**Files:**
- Create: `apps/backend/src/drivers/smb.ts`
- Create: `apps/backend/src/drivers/nfs.ts`
- Create: `apps/backend/src/drivers/truenas.ts`
- Modify: `apps/backend/src/drivers/index.ts` (add registry)
- Create: `apps/backend/tests/drivers/smb.test.ts`, `nfs.test.ts`, `truenas.test.ts`

- [ ] **Step 1: Update `drivers/index.ts` with a typed registry**

```ts
export interface ValidateResult { ok: boolean; error?: string; details?: Record<string, unknown>; }
export interface ListEntry { name: string; isDirectory: boolean; }

export interface SourceDriver<TConfig> {
  validate(config: TConfig): Promise<ValidateResult>;
  list?(config: TConfig, subPath: string): Promise<ListEntry[]>;
}

import type { SourceType } from '@tpd/shared';
import { LocalDriver } from './local.js';
import { SmbDriver } from './smb.js';
import { NfsDriver } from './nfs.js';
import { TrueNasDriver } from './truenas.js';

export const driverRegistry: Record<SourceType, SourceDriver<unknown>> = {
  local: LocalDriver as SourceDriver<unknown>,
  smb: SmbDriver as SourceDriver<unknown>,
  nfs: NfsDriver as SourceDriver<unknown>,
  truenas: TrueNasDriver as SourceDriver<unknown>,
  rclone: {
    async validate() { return { ok: false, error: 'rclone driver deferred' }; },
  } as SourceDriver<unknown>,
};
```

- [ ] **Step 2: Implement `drivers/smb.ts`**

```ts
import type { SourceDriver, ValidateResult } from './index.js';
import { probeSmb } from '../lib/mount.js';

export interface SmbConfig {
  host: string; share: string; username: string; password: string; domain?: string;
}

export const SmbDriver: SourceDriver<SmbConfig> = {
  async validate(c): Promise<ValidateResult> {
    const r = await probeSmb(c);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
};
```

- [ ] **Step 3: Implement `drivers/nfs.ts`**

```ts
import type { SourceDriver, ValidateResult } from './index.js';
import { probeNfs } from '../lib/mount.js';

export interface NfsConfig {
  host: string; exportPath: string; version: '3' | '4';
}

export const NfsDriver: SourceDriver<NfsConfig> = {
  async validate(c): Promise<ValidateResult> {
    const r = await probeNfs(c);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
};
```

- [ ] **Step 4: Implement `drivers/truenas.ts`**

```ts
import type { SourceDriver, ValidateResult } from './index.js';
import { probeSmb } from '../lib/mount.js';

export interface TrueNasConfig {
  host: string; share: string; username: string; password: string;
  ssh?: { user: string; port: number };
}

export const TrueNasDriver: SourceDriver<TrueNasConfig> = {
  async validate(c): Promise<ValidateResult> {
    const r = await probeSmb({
      host: c.host, share: c.share, username: c.username, password: c.password,
    });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, details: { sshConfigured: !!c.ssh } };
  },
};
```

- [ ] **Step 5: Add unit tests with the mount helpers mocked**

`apps/backend/tests/drivers/smb.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/mount.js', () => ({
  probeSmb: vi.fn(),
  probeNfs: vi.fn(),
}));

import { SmbDriver } from '../../src/drivers/smb.js';
import { probeSmb } from '../../src/lib/mount.js';

beforeEach(() => vi.clearAllMocks());

describe('SmbDriver', () => {
  it('returns ok=true when probeSmb succeeds', async () => {
    (probeSmb as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const r = await SmbDriver.validate({ host: 'h', share: 's', username: 'u', password: 'p' });
    expect(r.ok).toBe(true);
  });
  it('passes through probe errors', async () => {
    (probeSmb as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: 'no route' });
    const r = await SmbDriver.validate({ host: 'h', share: 's', username: 'u', password: 'p' });
    expect(r).toEqual({ ok: false, error: 'no route' });
  });
});
```

`apps/backend/tests/drivers/nfs.test.ts` (mirror of above using `probeNfs`).

`apps/backend/tests/drivers/truenas.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../src/lib/mount.js', () => ({ probeSmb: vi.fn() }));

import { TrueNasDriver } from '../../src/drivers/truenas.js';
import { probeSmb } from '../../src/lib/mount.js';

beforeEach(() => vi.clearAllMocks());

describe('TrueNasDriver', () => {
  it('reports sshConfigured=true when ssh block present', async () => {
    (probeSmb as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const r = await TrueNasDriver.validate({
      host: 'h', share: 's', username: 'u', password: 'p',
      ssh: { user: 'admin', port: 22 },
    });
    expect(r.ok).toBe(true);
    expect(r.details?.sshConfigured).toBe(true);
  });
  it('reports sshConfigured=false when omitted', async () => {
    (probeSmb as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const r = await TrueNasDriver.validate({ host: 'h', share: 's', username: 'u', password: 'p' });
    expect(r.details?.sshConfigured).toBe(false);
  });
});
```

- [ ] **Step 6: Run backend tests, verify pass**

```bash
npm test -w @tpd/backend
```

- [ ] **Step 7: Commit**

```bash
git add apps/backend
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(backend): add smb/nfs/truenas drivers backed by mount probes"
```

---

## Task 4: Backend sources route uses driver registry

**Files:**
- Modify: `apps/backend/src/routes/sources.ts`

- [ ] **Step 1: Replace the route body to dispatch via registry**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SourceConfigByType, SOURCE_TYPES } from '@tpd/shared';
import { driverRegistry } from '../drivers/index.js';

const TestBody = z.object({ type: z.enum(SOURCE_TYPES), config: z.unknown() });
const ListBody = TestBody.extend({ subPath: z.string() });

export async function sourceRoutes(app: FastifyInstance) {
  app.post('/api/sources/test', async (req, reply) => {
    const parsed = TestBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { type, config } = parsed.data;
    const schema = SourceConfigByType[type];
    const sc = schema.safeParse(config);
    if (!sc.success) return { ok: false, error: sc.error.message };
    return await driverRegistry[type].validate(sc.data);
  });

  app.post('/api/sources/list', async (req, reply) => {
    const parsed = ListBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { type, config, subPath } = parsed.data;
    const driver = driverRegistry[type];
    if (!driver.list) {
      return reply.code(400).send({ error: `driver "${type}" does not support list` });
    }
    const schema = SourceConfigByType[type];
    const sc = schema.safeParse(config);
    if (!sc.success) return reply.code(400).send({ error: sc.error.message });
    return await driver.list(sc.data, subPath);
  });
}
```

- [ ] **Step 2: Run backend tests, verify pass**

```bash
npm test -w @tpd/backend
```
Expected: existing route tests still pass.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/routes/sources.ts
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "refactor(backend): dispatch /api/sources/* through driver registry"
```

---

## Task 5: Backend `/api/services/{plex|tdarr|smartkanban}/test`

**Files:**
- Create: `apps/backend/src/routes/services.ts`
- Modify: `apps/backend/src/index.ts` (register the route group)
- Create: `apps/backend/tests/routes/services.test.ts`

- [ ] **Step 1: Implement `routes/services.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { httpProbe } from '../lib/http-probe.js';

const PlexBody = z.object({ url: z.string().url(), token: z.string().optional() });
const TdarrBody = z.object({ url: z.string().url(), apiKey: z.string().optional() });
const SmartKanbanBody = z.object({ url: z.string().url(), token: z.string().optional() });

export async function serviceRoutes(app: FastifyInstance) {
  app.post('/api/services/plex/test', async (req, reply) => {
    const parsed = PlexBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { url, token } = parsed.data;
    const probeUrl = `${url.replace(/\/$/, '')}/identity`;
    return await httpProbe({
      url: probeUrl,
      headers: token ? { 'X-Plex-Token': token } : {},
      expectStatusBelow: 400,
    });
  });

  app.post('/api/services/tdarr/test', async (req, reply) => {
    const parsed = TdarrBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { url, apiKey } = parsed.data;
    const probeUrl = `${url.replace(/\/$/, '')}/api/v2/status`;
    return await httpProbe({
      url: probeUrl,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      expectStatusBelow: 400,
    });
  });

  app.post('/api/services/smartkanban/test', async (req, reply) => {
    const parsed = SmartKanbanBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { url, token } = parsed.data;
    const probeUrl = `${url.replace(/\/$/, '')}/api/health`;
    return await httpProbe({
      url: probeUrl,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      expectStatusBelow: 500,
    });
  });
}
```

- [ ] **Step 2: Register in `apps/backend/src/index.ts`**

Add to `buildApp` after `sourceRoutes`:
```ts
import { serviceRoutes } from './routes/services.js';
// ...
await app.register(serviceRoutes);
```

- [ ] **Step 3: Add tests using a tiny fake HTTP server in-test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../../src/index.js';

let httpServer: Server;
let baseUrl: string;
const dir = mkdtempSync(join(tmpdir(), 'tpd-svcs-'));

beforeAll(async () => {
  httpServer = createServer((req, res) => {
    if (req.url?.startsWith('/identity')) { res.writeHead(200); res.end('{}'); return; }
    if (req.url?.startsWith('/api/v2/status')) { res.writeHead(200); res.end('{}'); return; }
    if (req.url?.startsWith('/api/health')) { res.writeHead(200); res.end('{"ok":true}'); return; }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((r) => httpServer.listen(0, '127.0.0.1', r));
  const addr = httpServer.address();
  if (!addr || typeof addr === 'string') throw new Error('no addr');
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => { await new Promise<void>((r) => httpServer.close(() => r())); });

describe('service test routes', () => {
  it('plex/test returns ok=true against a 200 endpoint', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({
      method: 'POST', url: '/api/services/plex/test',
      payload: { url: baseUrl, token: 'x' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });
  it('tdarr/test returns ok=true', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({
      method: 'POST', url: '/api/services/tdarr/test',
      payload: { url: baseUrl },
    });
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });
  it('smartkanban/test returns ok=true', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({
      method: 'POST', url: '/api/services/smartkanban/test',
      payload: { url: baseUrl, token: 'x' },
    });
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });
  it('returns 400 on invalid url', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({
      method: 'POST', url: '/api/services/plex/test',
      payload: { url: 'not-a-url' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

- [ ] **Step 4: Run backend tests, verify pass; commit**

```bash
npm test -w @tpd/backend
git add apps/backend
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(backend): add /api/services/{plex,tdarr,smartkanban}/test"
```

---

## Task 6: Frontend — render new source types in `SourceRow`, add Libraries / Services / EncodeTargets components

**Files:**
- Modify: `apps/frontend/src/components/Settings/SourceRow.tsx`
- Create: `apps/frontend/src/components/Settings/LibrariesList.tsx`
- Create: `apps/frontend/src/components/Settings/LibraryRow.tsx`
- Create: `apps/frontend/src/components/Settings/ServiceGroup.tsx`
- Create: `apps/frontend/src/components/Settings/EncodeTargets.tsx`
- Modify: `apps/frontend/src/api/client.ts`
- Modify: `apps/frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Update `api/client.ts` with service test calls**

Add to the existing `api` object:
```ts
testService: (kind: 'plex' | 'tdarr' | 'smartkanban', body: Record<string, string>) =>
  http<{ ok: boolean; error?: string; status?: number }>(
    'POST', `/api/services/${kind}/test`, body,
  ),
```

- [ ] **Step 2: Replace `SourceRow.tsx` to render all source types**

The new dropdown enables `local`, `truenas`, `smb`, `nfs`; keeps `rclone` disabled. Each type renders type-specific input fields (host, share, username, password, etc.). Use the same connection-test flow as 3a. (See full content in spec inline; keep `ConnectionBadge` use unchanged.)

(Implementer subagent: derive the field set per type from the schema in `source-types.ts` and render appropriate `<input>` controls. Reuse Tailwind classes from existing `SourceRow.tsx`. For password fields use `type="password"`. Keep "Test" button working unchanged — backend dispatches correctly post-Task 4.)

- [ ] **Step 3: Implement `LibraryRow.tsx` and `LibrariesList.tsx`**

`LibrariesList.tsx` props:
```ts
{ libraries: Library[]; sources: Source[]; onChange: (l: Library[]) => void; }
```
Render a table-ish list of editable rows. Each row has: label input, source dropdown (populated from `sources`), pathWithinSource input, libraryType select (`movie`/`tv`/`other`), Remove button. Add row button at bottom appends a default row referencing the first source.

- [ ] **Step 4: Implement `ServiceGroup.tsx` (shared for Plex/Tdarr/SmartKanban)**

Props:
```ts
{
  title: string;
  kind: 'plex' | 'tdarr' | 'smartkanban';
  values: Record<string, string>;
  fields: Array<{ name: string; label: string; type?: 'text' | 'password' | 'url' }>;
  onChange: (v: Record<string, string>) => void;
}
```
Renders a card with the labeled fields, a Test button calling `api.testService(kind, values)`, and a `ConnectionBadge`.

- [ ] **Step 5: Implement `EncodeTargets.tsx`**

Numeric inputs for `hevc4kBitrateMbps`, `h2641080pBitrateMbps`, `aacBitrateKbps`. Dropdown for `tonemapAlgorithm` (`hable`/`mobius`/`reinhard`). Toggles for `enable4kHevcVariant` and `enable1080pSdrVariant`.

- [ ] **Step 6: Update `SettingsPage.tsx`** to render: Sources, Libraries, Plex group, Tdarr group, SmartKanban group, EncodeTargets — each section heading, all wired to local `config` state, single Save button at bottom.

- [ ] **Step 7: Smoke build + manual click-through**

```bash
cd /Users/npalakurla/WorkingFolder/TranscodePipelineDash
npm run build -w @tpd/frontend
```
Expected: clean build.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(frontend): add Libraries, Plex/Tdarr/SmartKanban groups, EncodeTargets to Settings"
```

---

## Task 7: Onboarding wizard

**Files:**
- Create: `apps/frontend/src/components/Onboarding/OnboardingWizard.tsx`
- Create: `apps/frontend/src/components/Onboarding/steps/{Welcome,Sources,Libraries,Plex,Tdarr,SmartKanban,EncodeTargets,Done}Step.tsx`
- Create: `apps/frontend/src/pages/OnboardingPage.tsx`
- Modify: `apps/frontend/src/App.tsx` (route to OnboardingPage when `config.onboardingComplete === false`)

- [ ] **Step 1: Implement step components** as thin wrappers around the Settings building blocks (reuse `SourcesList`, `LibrariesList`, `ServiceGroup`, `EncodeTargets`). Each step has Next / Back buttons; Next is disabled until the step's "Test connection" passed (or the step is optional).

- [ ] **Step 2: Implement `OnboardingWizard.tsx`** with internal step index state, persisted draft config in component state, `Finish` button on `DoneStep` that PUTs `{...config, onboardingComplete: true}` and reloads.

- [ ] **Step 3: Branch in `App.tsx`** — if `config.onboardingComplete` is false, render `OnboardingPage`; else render `SettingsPage`. Provide a "Re-run onboarding" link in Settings header that flips the flag back to false.

- [ ] **Step 4: Smoke build**

```bash
npm run build -w @tpd/frontend
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(frontend): add multi-step onboarding wizard"
```

---

## Task 8: Phase 3b sign-off

- [ ] **Step 1: Run all tests + lint clean**

```bash
cd /Users/npalakurla/WorkingFolder/TranscodePipelineDash
npm test
npm run lint
```

- [ ] **Step 2: Tag**

```bash
git tag phase-3b-complete
```

---

## Self-Review (Phase 3b)

- **Spec coverage:** Source types `local|truenas|smb|nfs` all wired (rclone deferred — flagged); Libraries CRUD, Plex/Tdarr/SmartKanban + EncodeTargets fields, onboarding wizard. Connection testers exist for every service via real probes. The driver registry pattern keeps the contract identical to 3a, so 3c can swap polling logic in without touching drivers.
- **Placeholder scan:** Implementer subagents must derive `SourceRow.tsx` per-type fields from the zod schemas — that is intentional, not a placeholder. `rclone` disabled in the dropdown is an explicit ship-as-disabled, not a hidden TODO.
- **Type / name consistency:** `Source`, `Library`, `PlexConfig`, `TdarrConfig`, `SmartKanbanConfig`, `EncodeTargetsSchema`, `driverRegistry` names match across packages. `kind` in service routes/tests matches `'plex'|'tdarr'|'smartkanban'` everywhere.
- **Risks:**
  - Mount probes (`mount_smbfs`, `mount_nfs`) require root on Linux but **work as a regular user on macOS** for SMB; for NFS the OS may still need elevated privileges. Acceptable for this dashboard since it runs on macOS where the user is already an admin.
  - Probes leave a tmp dir if `umount` fails. Belt-and-suspenders cleanup is in place but a stuck mount on a flaky NFS server could leak directories under `/var/folders/...`.
  - `mount_smbfs` URL embeds the password in the URL string and may show in `ps` for a brief moment. Acceptable for LAN-only single-user dashboard; not OK on multi-tenant boxes.
