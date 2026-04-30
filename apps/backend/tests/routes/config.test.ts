import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../../src/index.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tpd-routes-'));
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });
});

describe('GET /api/config', () => {
  it('returns DEFAULT_CONFIG when no file exists', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ schemaVersion: 1, sources: [], libraries: [] });
    await app.close();
  });
});

describe('PUT /api/config', () => {
  it('saves and round-trips a valid config', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const body = {
      schemaVersion: 1,
      sources: [
        { id: 'src-1', label: 'Local', type: 'local', config: { path: '/tmp/media' } },
      ],
      libraries: [],
    };
    const put = await app.inject({ method: 'PUT', url: '/api/config', payload: body });
    expect(put.statusCode).toBe(200);
    const get = await app.inject({ method: 'GET', url: '/api/config' });
    expect(get.json()).toMatchObject(body);
    await app.close();
  });

  it('rejects an invalid config with 400', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config',
      payload: { schemaVersion: 1, sources: 'not an array', libraries: [] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
