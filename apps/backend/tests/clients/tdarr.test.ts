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
    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe('http://t/api/v2/status');
  });

  it('attaches Authorization header when apiKey set', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ nodes: [], queue: [], workers: [] }),
    });
    const c = new TdarrClient('http://t', 'k1');
    await c.getStatus();
    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer k1');
  });

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const c = new TdarrClient('http://t');
    await expect(c.getStatus()).rejects.toThrow(/500/);
  });

  it('POSTs cruddb with createdAt $gt filter', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    const c = new TdarrClient('http://t');
    await c.getHistory(123);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      data: { collection: 'JobReportTable', mode: 'getAll', docs: { createdAt: { $gt: 123 } } },
    });
  });
});
