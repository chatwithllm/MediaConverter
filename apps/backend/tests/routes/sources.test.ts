import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../../src/index.js';

let appRoot: string;
let mediaRoot: string;
beforeAll(() => {
  appRoot = mkdtempSync(join(tmpdir(), 'tpd-app-'));
  mediaRoot = mkdtempSync(join(tmpdir(), 'tpd-media-'));
  mkdirSync(join(mediaRoot, 'movies'));
});

describe('POST /api/sources/test', () => {
  it('returns ok=true for a valid local path', async () => {
    const app = await buildApp({ configFile: join(appRoot, 'config.json') });
    const res = await app.inject({
      method: 'POST',
      url: '/api/sources/test',
      payload: { type: 'local', config: { path: mediaRoot } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });

  it('returns ok=false for a missing path', async () => {
    const app = await buildApp({ configFile: join(appRoot, 'config.json') });
    const res = await app.inject({
      method: 'POST',
      url: '/api/sources/test',
      payload: { type: 'local', config: { path: '/no/such/path' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: false });
    await app.close();
  });
});

describe('POST /api/sources/list', () => {
  it('lists immediate children', async () => {
    const app = await buildApp({ configFile: join(appRoot, 'config.json') });
    const res = await app.inject({
      method: 'POST',
      url: '/api/sources/list',
      payload: { type: 'local', config: { path: mediaRoot }, subPath: '' },
    });
    expect(res.statusCode).toBe(200);
    const entries = res.json() as Array<{ name: string; isDirectory: boolean }>;
    expect(entries.find((e) => e.name === 'movies')?.isDirectory).toBe(true);
    await app.close();
  });
});
