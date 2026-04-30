import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CheckpointStore } from '../src/checkpoint.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tpd-cp-'));
});

describe('CheckpointStore', () => {
  it('returns 0 when no file', async () => {
    const c = new CheckpointStore(join(dir, 'cp.json'));
    expect(await c.load()).toBe(0);
  });

  it('round-trips a value', async () => {
    const file = join(dir, 'cp.json');
    const a = new CheckpointStore(file);
    await a.save(42);
    const b = new CheckpointStore(file);
    expect(await b.load()).toBe(42);
  });
});
