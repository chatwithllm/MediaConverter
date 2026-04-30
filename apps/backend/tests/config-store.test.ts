import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigStore } from '../src/config-store.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tpd-cfg-'));
});

describe('ConfigStore', () => {
  it('returns DEFAULT_CONFIG when no file exists', async () => {
    const store = new ConfigStore(join(dir, 'config.json'));
    const cfg = await store.load();
    expect(cfg.schemaVersion).toBe(1);
    expect(cfg.sources).toEqual([]);
    expect(cfg.libraries).toEqual([]);
  });

  it('persists and reloads a config round-trip', async () => {
    const file = join(dir, 'config.json');
    const a = new ConfigStore(file);
    await a.save({
      schemaVersion: 1,
      sources: [
        { id: 'src-1', label: 'Local', type: 'local', config: { path: '/tmp/media' } },
      ],
      libraries: [],
    });
    const b = new ConfigStore(file);
    const reloaded = await b.load();
    expect(reloaded.sources).toHaveLength(1);
    expect(reloaded.sources[0].id).toBe('src-1');
  });

  it('throws on a corrupt config file', async () => {
    const file = join(dir, 'config.json');
    const fs = await import('node:fs/promises');
    await fs.writeFile(file, '{ not valid json', 'utf8');
    const store = new ConfigStore(file);
    await expect(store.load()).rejects.toThrow(/invalid config/i);
  });
});
