import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlexClient } from '../../src/clients/plex.js';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('PlexClient', () => {
  it('attaches X-Plex-Token header on identity request', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ MediaContainer: { machineIdentifier: 'abc' } }),
    });
    const c = new PlexClient('http://p:32400', 'tok');
    const r = await c.getIdentity();
    expect(r.MediaContainer.machineIdentifier).toBe('abc');
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Plex-Token']).toBe('tok');
  });

  it('returns sections array (default empty)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ MediaContainer: {} }),
    });
    const c = new PlexClient('http://p:32400', 'tok');
    const r = await c.getSections();
    expect(r).toEqual([]);
  });

  it('returns recently-added Metadata array', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        MediaContainer: {
          Metadata: [{ ratingKey: '1', title: 'Dune', addedAt: 1234 }],
        },
      }),
    });
    const c = new PlexClient('http://p:32400', 'tok');
    const r = await c.getRecentlyAdded('1');
    expect(r).toHaveLength(1);
    expect(r[0]!.title).toBe('Dune');
  });

  it('throws on non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const c = new PlexClient('http://p:32400', 'bad');
    await expect(c.getIdentity()).rejects.toThrow(/401/);
  });
});
