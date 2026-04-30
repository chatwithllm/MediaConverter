import type { PipelineEvent } from '@tpd/shared';
import type { NodeId } from './flow-layout.js';

export interface FlowIndicators {
  activeNodes: Set<NodeId>;
  activeArrows: Set<string>;
  transfers: Array<{ arrowId: string; title: string; eventId: string }>;
  failedCount: number;
  countsByNode: Record<NodeId, number>;
}

const STAGE_TO_NODE: Record<string, NodeId | null> = {
  discovered: 'truenas',
  queued: 'tdarr',
  encoding: 'tdarr',
  verifying: 'tdarr',
  in_plex: 'plex',
  failed: 'failed',
};

export function deriveIndicators(snap: Map<string, PipelineEvent>): FlowIndicators {
  const activeNodes = new Set<NodeId>();
  const activeArrows = new Set<string>();
  const transfers: FlowIndicators['transfers'] = [];
  const counts: Record<NodeId, number> = {
    truenas: 0, tdarr: 0, m4: 0, m1: 0, plex: 0, failed: 0,
  };
  let failedCount = 0;

  for (const ev of snap.values()) {
    let node: NodeId | null = STAGE_TO_NODE[ev.stage] ?? null;
    if (ev.stage === 'encoding' && ev.node) {
      const lower = ev.node.toLowerCase();
      if (lower === 'm4' || lower.includes('mini')) node = 'm4';
      else if (lower === 'm1' || lower.includes('mbp')) node = 'm1';
    }
    if (node) {
      activeNodes.add(node);
      counts[node] += 1;
    }
    if (ev.stage === 'failed') failedCount += 1;

    if (ev.stage === 'discovered') activeArrows.add('truenas-tdarr');
    if (ev.stage === 'queued') activeArrows.add('truenas-tdarr');
    if (ev.stage === 'encoding') {
      if (node === 'm4') activeArrows.add('tdarr-m4');
      else if (node === 'm1') activeArrows.add('tdarr-m1');
    }
    if (ev.stage === 'verifying') {
      const arrowId = ev.node?.toLowerCase().includes('m1') ? 'm1-plex' : 'm4-plex';
      activeArrows.add(arrowId);
      transfers.push({ arrowId, title: ev.title, eventId: ev.fileId });
    }
    if (ev.stage === 'failed') activeArrows.add('tdarr-failed');
  }

  return { activeNodes, activeArrows, transfers, failedCount, countsByNode: counts };
}
