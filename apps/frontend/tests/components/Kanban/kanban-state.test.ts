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
