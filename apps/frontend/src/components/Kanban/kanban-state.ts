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
  const out: Record<KanbanColumnId, PipelineEvent[]> = {
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
    out[col].push(ev);
  }
  for (const c of KANBAN_COLUMNS) {
    out[c].sort((a, b) => b.ts - a.ts);
  }
  return out;
}
