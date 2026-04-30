# Phase 3e — Kanban View (Per-File Lifecycle Drill-Down)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the per-file Kanban view with columns `Discovered → Queued → Encoding @M4 → Encoding @M1 → Verifying → In Plex → Failed`. Cards represent files and auto-flow left to right as SSE events arrive. Add a third tab to the App (`flow | kanban | settings`) and a node-click handler in the Flow view that switches to Kanban with a node filter applied.

**Architecture:** Pure-function reducer maps `Map<fileId, PipelineEvent>` → `Record<columnId, PipelineEvent[]>`. Columns are rendered in a horizontal scroll container. Filter prop narrows the snapshot to events whose stage maps to a column matching the filter (e.g. clicking M4 in Flow filters Kanban to "Encoding @M4" + "Verifying" cards on M4).

**Tech additions:** None.

**Source spec:** [docs/superpowers/specs/2026-04-29-truenas-plex-transcode-pipeline-design.md](../specs/2026-04-29-truenas-plex-transcode-pipeline-design.md)

**Parent plan:** [2026-04-29-truenas-plex-transcode-pipeline.md](./2026-04-29-truenas-plex-transcode-pipeline.md)

## File Structure

```
apps/frontend/
  src/
    components/Kanban/
      kanban-state.ts          # NEW: reducer
      KanbanColumn.tsx         # NEW
      KanbanCard.tsx           # NEW
      KanbanView.tsx           # NEW
    pages/
      KanbanPage.tsx           # NEW
    App.tsx                    # MODIFY: third tab + node-click filter
  tests/components/Kanban/
    kanban-state.test.ts       # NEW
```

## Task 1: Reducer + tests + components + page + App tab

### Step 1: `kanban-state.ts`

```ts
import type { PipelineEvent } from '@tpd/shared';

export const KANBAN_COLUMNS = [
  'discovered',
  'queued',
  'encoding-m4',
  'encoding-m1',
  'verifying',
  'in_plex',
  'failed',
] as const;
export type KanbanColumnId = (typeof KANBAN_COLUMNS)[number];

export const COLUMN_LABELS: Record<KanbanColumnId, string> = {
  discovered: 'Discovered',
  queued: 'Queued',
  'encoding-m4': 'Encoding @ M4',
  'encoding-m1': 'Encoding @ M1',
  verifying: 'Verifying',
  in_plex: 'In Plex',
  failed: 'Failed',
};

export function pickColumn(ev: PipelineEvent): KanbanColumnId | null {
  if (ev.stage === 'discovered') return 'discovered';
  if (ev.stage === 'queued') return 'queued';
  if (ev.stage === 'encoding') {
    const lower = ev.node?.toLowerCase() ?? '';
    if (lower.includes('m1') || lower.includes('mbp')) return 'encoding-m1';
    return 'encoding-m4';
  }
  if (ev.stage === 'verifying') return 'verifying';
  if (ev.stage === 'in_plex') return 'in_plex';
  if (ev.stage === 'failed') return 'failed';
  return null;
}

export function groupBySnapshot(
  snap: Map<string, PipelineEvent>,
  filter?: { column?: KanbanColumnId },
): Record<KanbanColumnId, PipelineEvent[]> {
  const empty: Record<KanbanColumnId, PipelineEvent[]> = {
    discovered: [],
    queued: [],
    'encoding-m4': [],
    'encoding-m1': [],
    verifying: [],
    in_plex: [],
    failed: [],
  };
  for (const ev of snap.values()) {
    const col = pickColumn(ev);
    if (!col) continue;
    if (filter?.column && col !== filter.column) continue;
    empty[col].push(ev);
  }
  for (const c of KANBAN_COLUMNS) {
    empty[c].sort((a, b) => b.ts - a.ts);
  }
  return empty;
}
```

### Step 2: `tests/components/Kanban/kanban-state.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { groupBySnapshot, pickColumn } from '../../../src/components/Kanban/kanban-state.js';
import type { PipelineEvent } from '@tpd/shared';

function ev(p: Partial<PipelineEvent>): PipelineEvent {
  return { fileId: 'x', title: 'x', stage: 'queued', ts: 1, ...p } as PipelineEvent;
}

describe('pickColumn', () => {
  it('routes encoding M4', () => expect(pickColumn(ev({ stage: 'encoding', node: 'M4' }))).toBe('encoding-m4'));
  it('routes encoding M1', () => expect(pickColumn(ev({ stage: 'encoding', node: 'M1' }))).toBe('encoding-m1'));
  it('routes encoding default to M4', () => expect(pickColumn(ev({ stage: 'encoding' }))).toBe('encoding-m4'));
  it('routes failed', () => expect(pickColumn(ev({ stage: 'failed' }))).toBe('failed'));
});

describe('groupBySnapshot', () => {
  it('groups events by column', () => {
    const s = new Map<string, PipelineEvent>([
      ['a', ev({ fileId: 'a', stage: 'queued', ts: 1 })],
      ['b', ev({ fileId: 'b', stage: 'queued', ts: 2 })],
      ['c', ev({ fileId: 'c', stage: 'in_plex', ts: 3 })],
    ]);
    const r = groupBySnapshot(s);
    expect(r.queued.map((e) => e.fileId)).toEqual(['b', 'a']);
    expect(r.in_plex).toHaveLength(1);
  });

  it('applies column filter', () => {
    const s = new Map<string, PipelineEvent>([
      ['a', ev({ fileId: 'a', stage: 'queued' })],
      ['b', ev({ fileId: 'b', stage: 'in_plex' })],
    ]);
    const r = groupBySnapshot(s, { column: 'queued' });
    expect(r.queued).toHaveLength(1);
    expect(r.in_plex).toHaveLength(0);
  });
});
```

### Step 3: `KanbanCard.tsx`

```tsx
import type { PipelineEvent } from '@tpd/shared';

export function KanbanCard({ ev }: { ev: PipelineEvent }) {
  const pct = ev.progress !== undefined ? Math.round(ev.progress * 100) : null;
  return (
    <div className="border rounded p-2 mb-2 bg-white text-xs">
      <div className="font-semibold truncate">{ev.title}</div>
      <div className="opacity-70 mt-1 flex flex-wrap gap-1">
        {ev.node && <span className="bg-ink/10 px-1 rounded">{ev.node}</span>}
        {ev.sourceCodec && <span>{ev.sourceCodec}</span>}
        {ev.targetCodec && <span>→ {ev.targetCodec}</span>}
      </div>
      {pct !== null && (
        <div className="mt-1">
          <div className="h-1 bg-ink/10 rounded">
            <div className="h-1 bg-accent rounded" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[10px] opacity-60 mt-0.5">
            {pct}%{ev.etaSeconds ? ` · ETA ${Math.round(ev.etaSeconds / 60)}m` : ''}
          </div>
        </div>
      )}
      {ev.errorMessage && (
        <div className="mt-1 text-danger truncate" title={ev.errorMessage}>
          {ev.errorMessage}
        </div>
      )}
    </div>
  );
}
```

### Step 4: `KanbanColumn.tsx`

```tsx
import type { PipelineEvent } from '@tpd/shared';
import { KanbanCard } from './KanbanCard.js';

export function KanbanColumn({
  label,
  events,
}: {
  label: string;
  events: PipelineEvent[];
}) {
  return (
    <div className="flex flex-col w-56 shrink-0 bg-ink/5 rounded p-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs opacity-60">{events.length}</span>
      </div>
      <div className="overflow-y-auto">
        {events.map((e) => (
          <KanbanCard key={e.fileId} ev={e} />
        ))}
        {events.length === 0 && (
          <div className="text-[10px] opacity-50">empty</div>
        )}
      </div>
    </div>
  );
}
```

### Step 5: `KanbanView.tsx`

```tsx
import { useMemo } from 'react';
import { useEventStream } from '../../hooks/useEventStream.js';
import {
  KANBAN_COLUMNS,
  COLUMN_LABELS,
  groupBySnapshot,
  type KanbanColumnId,
} from './kanban-state.js';
import { KanbanColumn } from './KanbanColumn.js';

export function KanbanView({ filterColumn }: { filterColumn?: KanbanColumnId }) {
  const { snapshot } = useEventStream();
  const grouped = useMemo(
    () =>
      groupBySnapshot(
        snapshot,
        filterColumn ? { column: filterColumn } : undefined,
      ),
    [snapshot, filterColumn],
  );
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {KANBAN_COLUMNS.map((c) => (
        <KanbanColumn key={c} label={COLUMN_LABELS[c]} events={grouped[c]} />
      ))}
    </div>
  );
}
```

### Step 6: `KanbanPage.tsx`

```tsx
import { KanbanView } from '../components/Kanban/KanbanView.js';
import type { KanbanColumnId } from '../components/Kanban/kanban-state.js';

export function KanbanPage({ filterColumn }: { filterColumn?: KanbanColumnId }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">
        Lifecycle{filterColumn ? ` — ${filterColumn}` : ''}
      </h2>
      <KanbanView {...(filterColumn ? { filterColumn } : {})} />
    </div>
  );
}
```

### Step 7: Modify `App.tsx` to add Kanban tab + node-click filter

```tsx
import { useEffect, useState } from 'react';
import type { Config } from '@tpd/shared';
import { api } from './api/client.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { OnboardingPage } from './pages/OnboardingPage.js';
import { FlowPage } from './pages/FlowPage.js';
import { KanbanPage } from './pages/KanbanPage.js';
import type { KanbanColumnId } from './components/Kanban/kanban-state.js';

type Tab = 'flow' | 'kanban' | 'settings';

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>('flow');
  const [kanbanFilter, setKanbanFilter] = useState<KanbanColumnId | undefined>(undefined);

  useEffect(() => {
    api.getConfig().then(setConfig);
  }, [reloadKey]);

  if (!config) return <div className="min-h-screen p-6">Loading…</div>;

  if (!config.onboardingComplete) {
    return (
      <div className="min-h-screen p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-accent">TranscodePipelineDash</h1>
        </header>
        <OnboardingPage onComplete={() => setReloadKey((k) => k + 1)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-accent">TranscodePipelineDash</h1>
        <nav className="flex gap-1 ml-auto">
          {(['flow', 'kanban', 'settings'] as const).map((t) => (
            <button
              key={t}
              className={
                'text-sm px-3 py-1 rounded ' +
                (tab === t ? 'bg-accent text-white' : 'bg-ink/10 hover:bg-ink/15')
              }
              onClick={() => {
                setTab(t);
                if (t !== 'kanban') setKanbanFilter(undefined);
              }}
            >
              {t}
            </button>
          ))}
          <button
            className="text-xs underline opacity-70 hover:opacity-100 ml-2"
            onClick={async () => {
              await api.putConfig({ ...config, onboardingComplete: false } as Config);
              setReloadKey((k) => k + 1);
            }}
          >
            Re-run onboarding
          </button>
        </nav>
      </header>
      <main>
        {tab === 'flow' && (
          <FlowPage
            onNodeClick={(nodeId: string) => {
              const map: Record<string, KanbanColumnId | undefined> = {
                truenas: 'discovered',
                tdarr: 'queued',
                m4: 'encoding-m4',
                m1: 'encoding-m1',
                plex: 'in_plex',
                failed: 'failed',
              };
              const col = map[nodeId];
              if (col) {
                setKanbanFilter(col);
                setTab('kanban');
              }
            }}
          />
        )}
        {tab === 'kanban' && <KanbanPage {...(kanbanFilter ? { filterColumn: kanbanFilter } : {})} />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
```

### Step 8: Update `FlowPage.tsx` and `FlowView.tsx` to forward node-click

`FlowPage.tsx`:
```tsx
import { FlowView } from '../components/Flow/FlowView.js';

export function FlowPage({ onNodeClick }: { onNodeClick?: (id: string) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Live Flow</h2>
      <FlowView {...(onNodeClick ? { onNodeClick } : {})} />
    </div>
  );
}
```

`FlowView.tsx` — modify to accept and pass `onNodeClick`:
```tsx
// add to props
{ onNodeClick }: { onNodeClick?: (id: string) => void }
// in TopologyNode render, pass:
onClick={onNodeClick ? () => onNodeClick(n.id) : undefined}
```

### Step 9: Build + tests

```bash
cd /Users/npalakurla/WorkingFolder/TranscodePipelineDash
npm test -w @tpd/frontend
npm run build -w @tpd/frontend
```

### Step 10: Commit + tag

```bash
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla add apps/frontend
git -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "feat(frontend): add Kanban view with column filter from Flow node click"
git tag phase-3e-complete
```

## Self-Review

- Spec coverage: per-file Kanban with stage→column routing including M4/M1 split, click-from-Flow drill-down. Done.
- Risks: card list grows unbounded — should add a max-age cull (e.g. drop cards older than 24h) once running with real data.
