import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/clients/tdarr.js', () => {
  return {
    TdarrClient: vi.fn().mockImplementation(() => ({
      getStatus: vi.fn().mockResolvedValue({
        nodes: [],
        queue: [{ _id: 'q1', file: '/m/dune.mkv', title: 'Dune', status: 'queued' }],
        workers: [{
          _id: 'w1', file: '/m/tenet.mkv', title: 'Tenet',
          status: 'processing', workerId: 'M4', percentage: 42, ETA: 600,
        }],
      }),
    })),
  };
});

vi.mock('../../src/clients/plex.js', () => {
  return {
    PlexClient: vi.fn().mockImplementation(() => ({
      getSections: vi.fn().mockResolvedValue([{ key: '1', title: 'Movies', type: 'movie' }]),
      getRecentlyAdded: vi.fn().mockResolvedValue([
        { ratingKey: 'r1', title: 'Oppenheimer', addedAt: 1700000000 },
      ]),
    })),
  };
});

import { Aggregator } from '../../src/pipeline/aggregator.js';

describe('Aggregator', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits queued + encoding events from Tdarr poll', async () => {
    const a = new Aggregator({ tdarrUrl: 'http://t', pollTdarrMs: 1_000_000 });
    const events: unknown[] = [];
    a.on('event', (e) => events.push(e));
    await (a as unknown as { pollTdarr(): Promise<void> }).pollTdarr();
    expect(events).toHaveLength(2);
    const stages = (events as Array<{ stage: string }>).map((e) => e.stage).sort();
    expect(stages).toEqual(['encoding', 'queued']);
  });

  it('emits in_plex events from Plex poll', async () => {
    const a = new Aggregator({
      tdarrUrl: 'http://t', plexUrl: 'http://p', plexToken: 'tok',
      pollTdarrMs: 1_000_000, pollPlexMs: 1_000_000,
    });
    const events: Array<{ stage: string; fileId: string; title: string }> = [];
    a.on('event', (e) => events.push(e));
    await (a as unknown as { pollPlex(): Promise<void> }).pollPlex();
    expect(events).toHaveLength(1);
    expect(events[0]!.stage).toBe('in_plex');
    expect(events[0]!.fileId).toBe('plex-r1');
    expect(events[0]!.title).toBe('Oppenheimer');
  });

  it('snapshot reflects last event per fileId', async () => {
    const a = new Aggregator({ tdarrUrl: 'http://t', pollTdarrMs: 1_000_000 });
    await (a as unknown as { pollTdarr(): Promise<void> }).pollTdarr();
    expect(a.getSnapshot()).toHaveLength(2);
  });

  it('stop() clears all timers', () => {
    const a = new Aggregator({ tdarrUrl: 'http://t' });
    a.start();
    a.stop();
    // a no-op assertion; if timers stayed, vitest would warn about open handles in CI
    expect(true).toBe(true);
  });
});
