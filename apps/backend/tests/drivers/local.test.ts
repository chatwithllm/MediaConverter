import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDriver } from '../../src/drivers/local.js';

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'tpd-local-'));
  mkdirSync(join(root, 'movies'));
  mkdirSync(join(root, 'tv'));
  writeFileSync(join(root, 'movies', 'README.txt'), 'hi');
});

describe('LocalDriver', () => {
  it('validates an existing readable directory', async () => {
    const r = await LocalDriver.validate({ path: root });
    expect(r.ok).toBe(true);
  });

  it('returns ok=false for a non-existent path', async () => {
    const r = await LocalDriver.validate({ path: join(root, 'does-not-exist') });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not exist|enoent/i);
  });

  it('lists immediate children of a path', async () => {
    const entries = await LocalDriver.list({ path: root }, '');
    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(['movies', 'tv']);
    expect(entries.find((e) => e.name === 'movies')?.isDirectory).toBe(true);
  });

  it('rejects path traversal outside the configured root', async () => {
    await expect(LocalDriver.list({ path: root }, '../../../etc')).rejects.toThrow(
      /outside source root/i,
    );
  });
});
