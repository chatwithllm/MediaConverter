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
