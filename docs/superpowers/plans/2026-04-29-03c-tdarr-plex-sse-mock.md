# Phase 3c — Tdarr + Plex Clients, SSE Pipeline, Mock Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Wire the dashboard to real Tdarr + Plex APIs, normalize their data into a stable event stream, expose that stream to the frontend over SSE, and provide a mock-mode harness so the UI can be developed and demoed without any real services running.

**Architecture:**
- `apps/backend/src/clients/tdarr.ts` — typed wrapper over Tdarr's REST API (`/api/v2/status`, `/api/v2/cruddb`).
- `apps/backend/src/clients/plex.ts` — typed wrapper over Plex (`/identity`, `/library/sections`, `/library/recently_added`).
- `apps/backend/src/pipeline/events.ts` — normalized `PipelineEvent` shape `{ fileId, title, stage, node?, progress?, eta?, ts, sourceCodec?, targetCodec? }` with stages `discovered|queued|encoding|verifying|in_plex|failed`.
- `apps/backend/src/pipeline/aggregator.ts` — polls Tdarr (5s) + Plex (30s), watches `_staging`/`_failed` dirs (when configured), emits `PipelineEvent`s on an internal `EventEmitter`. Stateful only insofar as it tracks "last seen" timestamps to avoid replaying.
- `apps/backend/src/routes/events.ts` — Fastify SSE route `/api/events` that subscribes to the aggregator's emitter, sends initial snapshot of in-flight files, then streams new events as they arrive.
- `apps/backend/src/pipeline/mock.ts` — alternate aggregator implementation that fabricates a believable stream (3 files moving through stages) on a fixed cadence. Selected when `MOCK=1` env var is set.
- `apps/frontend/src/hooks/useEventStream.ts` — opens an `EventSource` against `/api/events`, manages reconnection + a `Map<fileId, PipelineEvent>` snapshot.
- `apps/frontend/src/state/pipelineStore.ts` — minimal subscribe API (no Redux/zustand, just a custom hook + module-level Map) so 3d/3e views can read the same state.

**Tech stack additions:** None. `EventEmitter`, native SSE, `EventSource`, `chokidar` (already a sensible default for FS watching — add as dep).

**Source spec:** [docs/superpowers/specs/2026-04-29-truenas-plex-transcode-pipeline-design.md](../specs/2026-04-29-truenas-plex-transcode-pipeline-design.md)

**Parent plan:** [2026-04-29-truenas-plex-transcode-pipeline.md](./2026-04-29-truenas-plex-transcode-pipeline.md)

---

## File Structure (created/modified)

```
TranscodePipelineDash/
  packages/shared/
    src/
      pipeline-event.ts             # NEW: PipelineEvent type + Stage enum
      index.ts                      # MODIFY: export pipeline-event
    tests/
      pipeline-event.test.ts        # NEW: schema validation
  apps/backend/
    src/
      clients/
        tdarr.ts                    # NEW: typed Tdarr client
        plex.ts                     # NEW: typed Plex client
      pipeline/
        events.ts                   # NEW: PipelineEvent zod + helpers
        aggregator.ts               # NEW: real aggregator (polls + watches)
        mock.ts                     # NEW: mock aggregator
        index.ts                    # NEW: pickAggregator(env) factory
      routes/
        events.ts                   # NEW: SSE endpoint
      index.ts                      # MODIFY: register events route, start aggregator
      env.ts                        # MODIFY: add MOCK flag
    tests/
      clients/
        tdarr.test.ts               # NEW (mocked fetch)
        plex.test.ts                # NEW (mocked fetch)
      pipeline/
        aggregator.test.ts          # NEW (against fakes)
        mock.test.ts                # NEW
      routes/
        events.test.ts              # NEW (subscribes to SSE via app.inject)
  apps/frontend/
    src/
      hooks/
        useEventStream.ts           # NEW
      state/
        pipelineStore.ts            # NEW
    tests/
      hooks/
        useEventStream.test.tsx     # NEW (mock EventSource)
```

---

## Task 1: Shared `PipelineEvent` schema

- [ ] **Step 1:** Create `packages/shared/src/pipeline-event.ts`:

```ts
import { z } from 'zod';

export const PIPELINE_STAGES = [
  'discovered',
  'queued',
  'encoding',
  'verifying',
  'in_plex',
  'failed',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PipelineEventSchema = z.object({
  fileId: z.string().min(1),
  title: z.string(),
  stage: z.enum(PIPELINE_STAGES),
  node: z.string().optional(),
  progress: z.number().min(0).max(1).optional(),
  etaSeconds: z.number().nonnegative().optional(),
  sourceCodec: z.string().optional(),
  targetCodec: z.string().optional(),
  errorMessage: z.string().optional(),
  ts: z.number().int().positive(),
});
export type PipelineEvent = z.infer<typeof PipelineEventSchema>;
```

- [ ] **Step 2:** Update `packages/shared/src/index.ts` to add `export * from './pipeline-event.js';`

- [ ] **Step 3:** Add tests `packages/shared/tests/pipeline-event.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PipelineEventSchema } from '../src/pipeline-event.js';

describe('PipelineEventSchema', () => {
  it('accepts minimal valid event', () => {
    const e = PipelineEventSchema.parse({
      fileId: 'f1', title: 'Dune', stage: 'queued', ts: Date.now(),
    });
    expect(e.stage).toBe('queued');
  });
  it('rejects unknown stage', () => {
    expect(() =>
      PipelineEventSchema.parse({ fileId: 'f1', title: 'x', stage: 'bogus', ts: 1 }),
    ).toThrow();
  });
  it('rejects progress > 1', () => {
    expect(() =>
      PipelineEventSchema.parse({
        fileId: 'f1', title: 'x', stage: 'encoding', progress: 1.5, ts: 1,
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 4:** Run + commit

```bash
npm test -w @tpd/shared
git add packages/shared
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(shared): add PipelineEvent schema and stages"
```

---

## Task 2: Tdarr REST client

- [ ] **Step 1:** Create `apps/backend/src/clients/tdarr.ts`:

```ts
export interface TdarrJob {
  _id: string;
  file: string;
  title?: string;
  status: 'queued' | 'processing' | 'success' | 'error' | 'cancelled' | string;
  workerId?: string;
  percentage?: number;
  ETA?: number;
  origLibraryFile?: { file: string };
}

export interface TdarrStatus {
  nodes: Array<{ _id: string; nodeName: string }>;
  queue: TdarrJob[];
  workers: TdarrJob[];
}

export class TdarrClient {
  constructor(private url: string, private apiKey?: string) {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
    const res = await fetch(`${this.url.replace(/\/$/, '')}${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`Tdarr ${path} ${res.status}`);
    return (await res.json()) as T;
  }

  async getStatus(): Promise<TdarrStatus> {
    return await this.req<TdarrStatus>('/api/v2/status');
  }

  async getHistory(sinceTs: number): Promise<TdarrJob[]> {
    return await this.req<TdarrJob[]>('/api/v2/cruddb', {
      method: 'POST',
      body: JSON.stringify({
        data: { collection: 'JobReportTable', mode: 'getAll', docs: { 'createdAt': { $gt: sinceTs } } },
      }),
    });
  }
}
```

- [ ] **Step 2:** Tests `apps/backend/tests/clients/tdarr.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TdarrClient } from '../../src/clients/tdarr.js';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('TdarrClient', () => {
  it('GETs /api/v2/status', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ nodes: [], queue: [], workers: [] }),
    });
    const c = new TdarrClient('http://t');
    const r = await c.getStatus();
    expect(r.queue).toEqual([]);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('http://t/api/v2/status');
  });

  it('attaches Authorization header when apiKey set', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ nodes: [], queue: [], workers: [] }) });
    const c = new TdarrClient('http://t', 'k1');
    await c.getStatus();
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer k1');
  });

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const c = new TdarrClient('http://t');
    await expect(c.getStatus()).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 3:** Run + commit

```bash
npm test -w @tpd/backend
git add apps/backend
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(backend): add TdarrClient (status, history)"
```

---

## Task 3: Plex REST client

Mirror Task 2 with `apps/backend/src/clients/plex.ts`:

```ts
export interface PlexLibrarySection { key: string; title: string; type: 'movie' | 'show' | string; }
export interface PlexRecentItem { ratingKey: string; title: string; addedAt: number; }

export class PlexClient {
  constructor(private url: string, private token: string) {}
  private async req<T>(path: string): Promise<T> {
    const res = await fetch(`${this.url.replace(/\/$/, '')}${path}`, {
      headers: {
        Accept: 'application/json',
        'X-Plex-Token': this.token,
      },
    });
    if (!res.ok) throw new Error(`Plex ${path} ${res.status}`);
    return (await res.json()) as T;
  }
  async getIdentity() {
    return await this.req<{ MediaContainer: { machineIdentifier: string } }>('/identity');
  }
  async getSections() {
    type Resp = { MediaContainer: { Directory: PlexLibrarySection[] } };
    const r = await this.req<Resp>('/library/sections');
    return r.MediaContainer?.Directory ?? [];
  }
  async getRecentlyAdded(sectionKey: string) {
    type Resp = { MediaContainer: { Metadata?: PlexRecentItem[] } };
    const r = await this.req<Resp>(`/library/sections/${sectionKey}/recentlyAdded`);
    return r.MediaContainer?.Metadata ?? [];
  }
}
```

Tests mirror `tdarr.test.ts` shape (mock fetch, assert URL + token header).

Commit:
```
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(backend): add PlexClient (identity, sections, recentlyAdded)"
```

---

## Task 4: Aggregator (real)

`apps/backend/src/pipeline/aggregator.ts`:

```ts
import { EventEmitter } from 'node:events';
import type { PipelineEvent, PipelineStage } from '@tpd/shared';
import { TdarrClient, TdarrJob } from '../clients/tdarr.js';
import { PlexClient } from '../clients/plex.js';

export interface AggregatorConfig {
  tdarrUrl: string; tdarrApiKey?: string;
  plexUrl?: string; plexToken?: string;
  pollTdarrMs?: number; pollPlexMs?: number;
}

function tdarrStatusToStage(s: string): PipelineStage {
  if (s === 'queued') return 'queued';
  if (s === 'processing') return 'encoding';
  if (s === 'success') return 'verifying';
  if (s === 'error' || s === 'cancelled') return 'failed';
  return 'discovered';
}

export class Aggregator extends EventEmitter {
  private snapshot = new Map<string, PipelineEvent>();
  private timers: NodeJS.Timeout[] = [];
  private tdarr: TdarrClient;
  private plex?: PlexClient;

  constructor(private cfg: AggregatorConfig) {
    super();
    this.tdarr = new TdarrClient(cfg.tdarrUrl, cfg.tdarrApiKey);
    if (cfg.plexUrl && cfg.plexToken) {
      this.plex = new PlexClient(cfg.plexUrl, cfg.plexToken);
    }
  }

  start() {
    const tdarrInterval = this.cfg.pollTdarrMs ?? 5000;
    const plexInterval = this.cfg.pollPlexMs ?? 30000;
    this.timers.push(setInterval(() => this.pollTdarr().catch(() => {}), tdarrInterval));
    if (this.plex) {
      this.timers.push(setInterval(() => this.pollPlex().catch(() => {}), plexInterval));
    }
    void this.pollTdarr().catch(() => {});
    if (this.plex) void this.pollPlex().catch(() => {});
  }

  stop() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  getSnapshot(): PipelineEvent[] {
    return Array.from(this.snapshot.values());
  }

  private emitEvent(e: PipelineEvent) {
    this.snapshot.set(e.fileId, e);
    this.emit('event', e);
  }

  private async pollTdarr() {
    const s = await this.tdarr.getStatus();
    const all: TdarrJob[] = [...s.queue, ...s.workers];
    for (const j of all) {
      const fileId = j._id;
      const title = j.title ?? j.origLibraryFile?.file ?? j.file ?? fileId;
      const stage = tdarrStatusToStage(j.status);
      const ev: PipelineEvent = {
        fileId, title, stage, ts: Date.now(),
        ...(j.workerId !== undefined ? { node: j.workerId } : {}),
        ...(j.percentage !== undefined ? { progress: j.percentage / 100 } : {}),
        ...(j.ETA !== undefined ? { etaSeconds: j.ETA } : {}),
      };
      this.emitEvent(ev);
    }
  }

  private async pollPlex() {
    if (!this.plex) return;
    const sections = await this.plex.getSections();
    for (const sec of sections) {
      const recents = await this.plex.getRecentlyAdded(sec.key);
      for (const r of recents) {
        const ev: PipelineEvent = {
          fileId: `plex-${r.ratingKey}`,
          title: r.title,
          stage: 'in_plex',
          ts: r.addedAt * 1000,
        };
        this.emitEvent(ev);
      }
    }
  }
}
```

Tests verify: emits events on poll using mocked `TdarrClient`/`PlexClient`. Use `vi.mock` to swap clients out.

Commit: `feat(backend): add real-services Aggregator`.

---

## Task 5: Mock aggregator

`apps/backend/src/pipeline/mock.ts` — same `EventEmitter` shape, but cycles 3 fake files through `discovered → queued → encoding (M4|M1) → verifying → in_plex` over ~30 seconds, looping. Trivial to implement and lets the frontend run end-to-end without a backend tdarr.

Pseudocode:
```ts
export class MockAggregator extends EventEmitter {
  private interval?: NodeJS.Timeout;
  private snap = new Map<string, PipelineEvent>();
  start() {
    let tick = 0;
    const titles = ['Dune (2021)', 'Tenet (2020)', 'Severance S02E03'];
    const stages: PipelineStage[] = ['discovered','queued','encoding','verifying','in_plex'];
    this.interval = setInterval(() => {
      titles.forEach((title, i) => {
        const stage = stages[(tick + i) % stages.length];
        const ev: PipelineEvent = {
          fileId: `mock-${i}`, title, stage,
          node: stage === 'encoding' ? (i % 2 === 0 ? 'M4' : 'M1') : undefined,
          progress: stage === 'encoding' ? ((tick % 5) / 5) : undefined,
          etaSeconds: stage === 'encoding' ? 60 : undefined,
          ts: Date.now(),
        };
        this.snap.set(ev.fileId, ev);
        this.emit('event', ev);
      });
      tick += 1;
    }, 3000);
  }
  stop() { if (this.interval) clearInterval(this.interval); }
  getSnapshot() { return Array.from(this.snap.values()); }
}
```

Tests assert it emits at least 3 events within the first 4 seconds (use `vi.useFakeTimers()`).

Commit: `feat(backend): add MockAggregator for dev without real tdarr/plex`.

---

## Task 6: Aggregator factory + env wiring

`apps/backend/src/pipeline/index.ts`:
```ts
import type { Config } from '@tpd/shared';
import { Aggregator } from './aggregator.js';
import { MockAggregator } from './mock.js';

export function pickAggregator(env: { mock: boolean }, cfg: Config) {
  if (env.mock) return new MockAggregator();
  return new Aggregator({
    tdarrUrl: cfg.tdarr.url,
    ...(cfg.tdarr.apiKey ? { tdarrApiKey: cfg.tdarr.apiKey } : {}),
    ...(cfg.plex.url ? { plexUrl: cfg.plex.url } : {}),
    ...(cfg.plex.token ? { plexToken: cfg.plex.token } : {}),
  });
}
```

`env.ts` adds `mock: process.env.MOCK === '1'`.

In `index.ts` `buildApp`: read config, call `pickAggregator(env, cfg)`, store on `app.decorate('aggregator', ...)`. Start it. Stop on close.

Commit: `feat(backend): wire aggregator factory into Fastify lifecycle`.

---

## Task 7: SSE endpoint

`apps/backend/src/routes/events.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import type { Aggregator } from '../pipeline/aggregator.js';
import type { MockAggregator } from '../pipeline/mock.js';
type AnyAggregator = Aggregator | MockAggregator;

export function eventsRoutes(getAgg: () => AnyAggregator) {
  return async function (app: FastifyInstance) {
    app.get('/api/events', (req, reply) => {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders();

      const agg = getAgg();
      // initial snapshot
      for (const ev of agg.getSnapshot()) {
        reply.raw.write(`event: snapshot\ndata: ${JSON.stringify(ev)}\n\n`);
      }
      const onEvent = (ev: unknown) =>
        reply.raw.write(`event: pipeline\ndata: ${JSON.stringify(ev)}\n\n`);
      agg.on('event', onEvent);

      const heartbeat = setInterval(() => reply.raw.write(': hb\n\n'), 15000);

      req.raw.on('close', () => {
        clearInterval(heartbeat);
        agg.off('event', onEvent);
      });
    });
  };
}
```

Register in `index.ts`.

Tests: spin up the app with a mock aggregator that emits one event after 50ms. Use `app.inject` with `payload: undefined`, but for SSE prefer a direct HTTP server boot and a real `EventSource`-like consumer. Or skip route tests here and rely on aggregator tests + a manual smoke check.

Commit: `feat(backend): expose /api/events SSE`.

---

## Task 8: Frontend `useEventStream` hook + pipelineStore

`apps/frontend/src/state/pipelineStore.ts`:
```ts
import type { PipelineEvent } from '@tpd/shared';
type Listener = (snap: Map<string, PipelineEvent>) => void;

const snap = new Map<string, PipelineEvent>();
const listeners = new Set<Listener>();
function notify() { for (const l of listeners) l(new Map(snap)); }

export const pipelineStore = {
  apply(ev: PipelineEvent) { snap.set(ev.fileId, ev); notify(); },
  reset() { snap.clear(); notify(); },
  snapshot() { return new Map(snap); },
  subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); },
};
```

`apps/frontend/src/hooks/useEventStream.ts`:
```ts
import { useEffect, useState } from 'react';
import type { PipelineEvent } from '@tpd/shared';
import { pipelineStore } from '../state/pipelineStore.js';

export function useEventStream(): { snapshot: Map<string, PipelineEvent>; status: 'connecting'|'open'|'closed' } {
  const [snap, setSnap] = useState(() => pipelineStore.snapshot());
  const [status, setStatus] = useState<'connecting'|'open'|'closed'>('connecting');

  useEffect(() => {
    const unsub = pipelineStore.subscribe(setSnap);
    const es = new EventSource('/api/events');
    es.onopen = () => setStatus('open');
    es.onerror = () => setStatus('closed');
    const handler = (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data) as PipelineEvent;
        pipelineStore.apply(ev);
      } catch { /* ignore */ }
    };
    es.addEventListener('snapshot', handler as EventListener);
    es.addEventListener('pipeline', handler as EventListener);
    return () => { unsub(); es.close(); };
  }, []);

  return { snapshot: snap, status };
}
```

Tests use a fake `EventSource` global to dispatch events and assert `pipelineStore` updates.

Commit: `feat(frontend): add useEventStream hook + pipelineStore`.

---

## Task 9: Phase 3c sign-off + tag

```bash
npm test
npm run lint
git tag phase-3c-complete
```

---

## Self-Review (Phase 3c)

- Spec coverage: Tdarr REST, Plex REST, SSE event pipeline, mock-mode harness — all per spec.
- Risks: real Tdarr's `cruddb` shape may differ between versions; client wraps errors but tests rely on a mocked successful shape. Once a real Tdarr is up, spot-check the response and adjust.
- Mock cadence (3 sec) is intentionally low so a developer can see motion. Production deployments are expected to use real aggregator.
