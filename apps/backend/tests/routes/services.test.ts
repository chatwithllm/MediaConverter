import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../../src/index.js';

let httpServer: Server;
let baseUrl: string;
const dir = mkdtempSync(join(tmpdir(), 'tpd-svcs-'));

beforeAll(async () => {
  httpServer = createServer((req, res) => {
    if (req.url?.startsWith('/identity')) { res.writeHead(200); res.end('{}'); return; }
    if (req.url?.startsWith('/api/v2/status')) { res.writeHead(200); res.end('{}'); return; }
    if (req.url?.startsWith('/api/health')) { res.writeHead(200); res.end('{"ok":true}'); return; }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((r) => httpServer.listen(0, '127.0.0.1', r));
  const addr = httpServer.address();
  if (!addr || typeof addr === 'string') throw new Error('no addr');
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => { await new Promise<void>((r) => httpServer.close(() => r())); });

describe('service test routes', () => {
  it('plex/test returns ok=true against a 200 endpoint', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({
      method: 'POST', url: '/api/services/plex/test',
      payload: { url: baseUrl, token: 'x' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });
  it('tdarr/test returns ok=true', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({
      method: 'POST', url: '/api/services/tdarr/test',
      payload: { url: baseUrl },
    });
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });
  it('smartkanban/test returns ok=true', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({
      method: 'POST', url: '/api/services/smartkanban/test',
      payload: { url: baseUrl, token: 'x' },
    });
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });
  it('returns 400 on invalid url', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({
      method: 'POST', url: '/api/services/plex/test',
      payload: { url: 'not-a-url' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
