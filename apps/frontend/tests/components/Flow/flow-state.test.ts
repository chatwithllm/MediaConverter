import { describe, it, expect } from 'vitest';
import { deriveIndicators } from '../../../src/components/Flow/flow-state.js';
import type { PipelineEvent } from '@tpd/shared';

function ev(p: Partial<PipelineEvent>): PipelineEvent {
  return { fileId: 'x', title: 'x', stage: 'queued', ts: 1, ...p } as PipelineEvent;
}

describe('deriveIndicators', () => {
  it('marks tdarr active on queued', () => {
    const s = new Map([['a', ev({ stage: 'queued' })]]);
    const r = deriveIndicators(s);
    expect(r.activeNodes.has('tdarr')).toBe(true);
    expect(r.activeArrows.has('truenas-tdarr')).toBe(true);
  });

  it('routes encoding to m4 when node says M4', () => {
    const s = new Map([['a', ev({ stage: 'encoding', node: 'M4' })]]);
    const r = deriveIndicators(s);
    expect(r.activeNodes.has('m4')).toBe(true);
    expect(r.activeArrows.has('tdarr-m4')).toBe(true);
  });

  it('routes encoding to m1 when node says M1', () => {
    const s = new Map([['a', ev({ stage: 'encoding', node: 'M1' })]]);
    const r = deriveIndicators(s);
    expect(r.activeNodes.has('m1')).toBe(true);
    expect(r.activeArrows.has('tdarr-m1')).toBe(true);
  });

  it('counts in_plex per plex node', () => {
    const s = new Map<string, PipelineEvent>([
      ['a', ev({ fileId: 'a', stage: 'in_plex' })],
      ['b', ev({ fileId: 'b', stage: 'in_plex' })],
    ]);
    const r = deriveIndicators(s);
    expect(r.countsByNode.plex).toBe(2);
  });

  it('counts failures', () => {
    const s = new Map([['a', ev({ stage: 'failed' })]]);
    const r = deriveIndicators(s);
    expect(r.failedCount).toBe(1);
    expect(r.activeArrows.has('tdarr-failed')).toBe(true);
  });

  it('produces transfer badge on verifying', () => {
    const s = new Map([['a', ev({ stage: 'verifying', node: 'M4', title: 'Dune' })]]);
    const r = deriveIndicators(s);
    expect(r.transfers).toHaveLength(1);
    expect(r.transfers[0]!.title).toBe('Dune');
  });
});
