import type { Library, Source } from '@tpd/shared';
import { LibraryRow } from './LibraryRow.js';

function newId() {
  return `lib-${Math.random().toString(36).slice(2, 8)}`;
}

export function LibrariesList({
  libraries,
  sources,
  onChange,
}: {
  libraries: Library[];
  sources: Source[];
  onChange: (l: Library[]) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Libraries</h2>
      {libraries.length === 0 && (
        <div className="text-sm opacity-60 mb-2">
          No libraries yet. Add one to map a source path to a Plex library.
        </div>
      )}
      {libraries.map((lib, i) => (
        <LibraryRow
          key={lib.id}
          library={lib}
          sources={sources}
          onChange={(next) => {
            const copy = [...libraries];
            copy[i] = next;
            onChange(copy);
          }}
          onRemove={() => onChange(libraries.filter((_, j) => j !== i))}
        />
      ))}
      <button
        className="px-3 py-1 mt-2 bg-accent text-white rounded"
        disabled={sources.length === 0}
        onClick={() =>
          onChange([
            ...libraries,
            {
              id: newId(),
              label: 'New library',
              sourceId: sources[0]?.id ?? '',
              pathWithinSource: '',
              libraryType: 'movie',
            },
          ])
        }
      >
        Add library
      </button>
    </div>
  );
}
