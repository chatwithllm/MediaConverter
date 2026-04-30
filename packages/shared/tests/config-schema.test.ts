import { describe, it, expect } from 'vitest';
import { ConfigSchema, SourceSchema, LibrarySchema } from '../src/config-schema.js';

describe('SourceSchema', () => {
  it('accepts a local source', () => {
    const parsed = SourceSchema.parse({
      id: 'src-local-1',
      label: 'Mac internal disk',
      type: 'local',
      config: { path: '/Users/test/Movies' },
    });
    expect(parsed.type).toBe('local');
  });

  it('rejects a local source without a path', () => {
    expect(() =>
      SourceSchema.parse({
        id: 'src-local-1',
        label: 'Mac internal disk',
        type: 'local',
        config: {},
      }),
    ).toThrow();
  });

  it('rejects an unknown source type', () => {
    expect(() =>
      SourceSchema.parse({
        id: 'src-x',
        label: 'x',
        type: 'webdav',
        config: {},
      }),
    ).toThrow();
  });
});

describe('LibrarySchema', () => {
  it('accepts a library row referencing a source by id', () => {
    const parsed = LibrarySchema.parse({
      id: 'lib-1',
      label: 'Movies',
      sourceId: 'src-local-1',
      pathWithinSource: 'movies',
      libraryType: 'movie',
    });
    expect(parsed.libraryType).toBe('movie');
  });

  it('rejects a library row with no sourceId', () => {
    expect(() =>
      LibrarySchema.parse({
        id: 'lib-1',
        label: 'Movies',
        pathWithinSource: 'movies',
        libraryType: 'movie',
      }),
    ).toThrow();
  });
});

describe('ConfigSchema', () => {
  it('accepts a minimal valid config', () => {
    const config = ConfigSchema.parse({
      schemaVersion: 1,
      sources: [
        {
          id: 'src-local-1',
          label: 'Local disk',
          type: 'local',
          config: { path: '/tmp/media' },
        },
      ],
      libraries: [
        {
          id: 'lib-1',
          label: 'Movies',
          sourceId: 'src-local-1',
          pathWithinSource: 'movies',
          libraryType: 'movie',
        },
      ],
    });
    expect(config.schemaVersion).toBe(1);
    expect(config.sources).toHaveLength(1);
    expect(config.libraries).toHaveLength(1);
  });

  it('rejects a library that points to a non-existent source id', () => {
    expect(() =>
      ConfigSchema.parse({
        schemaVersion: 1,
        sources: [],
        libraries: [
          {
            id: 'lib-1',
            label: 'Movies',
            sourceId: 'src-missing',
            pathWithinSource: 'movies',
            libraryType: 'movie',
          },
        ],
      }),
    ).toThrow(/sourceId.*not found/);
  });
});

describe('Source types beyond local', () => {
  it('accepts smb', () => {
    const s = SourceSchema.parse({
      id: 's', label: 's', type: 'smb',
      config: { host: '10.0.0.1', share: 'media', username: 'u', password: 'p' },
    });
    expect(s.type).toBe('smb');
  });
  it('accepts nfs with default version', () => {
    const s = SourceSchema.parse({
      id: 's', label: 's', type: 'nfs',
      config: { host: '10.0.0.1', exportPath: '/mnt/tank/media' },
    });
    expect(s.type).toBe('nfs');
    if (s.type === 'nfs') expect(s.config.version).toBe('4');
  });
  it('accepts truenas with optional ssh block', () => {
    const s = SourceSchema.parse({
      id: 's', label: 's', type: 'truenas',
      config: {
        host: '192.168.50.11', share: 'media', username: 'tdarr', password: 'p',
        ssh: { user: 'admin' },
      },
    });
    expect(s.type).toBe('truenas');
  });
});

describe('Service groups', () => {
  it('accepts an empty plex/tdarr/smartKanban', () => {
    const cfg = ConfigSchema.parse({ schemaVersion: 1, sources: [], libraries: [] });
    expect(cfg.plex.url).toBe('');
    expect(cfg.tdarr.url).toBe('');
    expect(cfg.smartKanban.url).toBe('');
  });
  it('rejects an invalid plex url', () => {
    expect(() =>
      ConfigSchema.parse({
        schemaVersion: 1, sources: [], libraries: [],
        plex: { url: 'not-a-url', token: '' },
      }),
    ).toThrow();
  });
});

describe('EncodeTargets defaults', () => {
  it('fills sensible defaults', () => {
    const cfg = ConfigSchema.parse({ schemaVersion: 1, sources: [], libraries: [] });
    expect(cfg.encodeTargets.hevc4kBitrateMbps).toBe(25);
    expect(cfg.encodeTargets.tonemapAlgorithm).toBe('hable');
    expect(cfg.encodeTargets.enable4kHevcVariant).toBe(true);
  });
});
