import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockAggregator } from '../../src/pipeline/mock.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('MockAggregator', () => {
  it('emits 3 events on each tick', () => {
    const a = new MockAggregator();
    const events: Array<{ stage: string }> = [];
    a.on('event', (e) => events.push(e));
    a.start();
    vi.advanceTimersByTime(3001);
    expect(events.length).toBe(3);
    a.stop();
  });

  it('cycles stages over multiple ticks', () => {
    const a = new MockAggregator();
    const stagesByTick: string[][] = [];
    let bucket: string[] = [];
    a.on('event', (e: { stage: string }) => bucket.push(e.stage));
    a.start();
    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(3001);
      stagesByTick.push(bucket);
      bucket = [];
      a.removeAllListeners('event');
      a.on('event', (e: { stage: string }) => bucket.push(e.stage));
    }
    const allStages = stagesByTick.flat();
    expect(new Set(allStages).size).toBeGreaterThan(1);
    a.stop();
  });

  it('snapshot grows to 3 fileIds', () => {
    const a = new MockAggregator();
    a.start();
    vi.advanceTimersByTime(3001);
    expect(a.getSnapshot()).toHaveLength(3);
    a.stop();
  });
});
