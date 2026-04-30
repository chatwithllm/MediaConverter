import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildApp } from '../../src/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let port: number;
const dir = mkdtempSync(join(tmpdir(), 'tpd-events-'));

beforeAll(async () => {
  app = await buildApp({ configFile: join(dir, 'config.json'), mock: true });
  await app.listen({ port: 0, host: '127.0.0.1' });
  port = (app.server.address() as AddressInfo).port;
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/events', () => {
  it('streams pipeline events as SSE', async () => {
    const collected = await new Promise<string>((resolve, reject) => {
      const req = request(
        { host: '127.0.0.1', port, path: '/api/events', method: 'GET' },
        (res) => {
          let buf = '';
          res.on('data', (chunk) => {
            buf += chunk.toString();
            if (buf.includes('event: pipeline')) {
              req.destroy();
              resolve(buf);
            }
          });
          res.on('end', () => resolve(buf));
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      req.end();

      // emit a synthetic event after the request opens
      setTimeout(() => {
        app.aggregator.emit('event', {
          fileId: 'evt-1',
          title: 'Test',
          stage: 'queued',
          ts: Date.now(),
        });
      }, 100);
    });
    expect(collected).toContain('event: pipeline');
    expect(collected).toContain('"fileId":"evt-1"');
    expect(collected).toContain('"stage":"queued"');
  }, 10000);
});
