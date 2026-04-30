import type { Source } from '@tpd/shared';
import { SourceRow } from './SourceRow.js';

function newId() {
  return `src-${Math.random().toString(36).slice(2, 8)}`;
}

export function SourcesList({
  sources,
  onChange,
}: {
  sources: Source[];
  onChange: (s: Source[]) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Sources</h2>
      {sources.map((s, i) => (
        <SourceRow
          key={s.id}
          source={s}
          onChange={(next) => {
            const copy = [...sources];
            copy[i] = next;
            onChange(copy);
          }}
          onRemove={() => onChange(sources.filter((_, j) => j !== i))}
        />
      ))}
      <button
        className="px-3 py-1 mt-2 bg-accent text-white rounded"
        onClick={() =>
          onChange([
            ...sources,
            {
              id: newId(),
              label: 'New source',
              type: 'local',
              config: { path: '' },
            },
          ])
        }
      >
        Add source
      </button>
    </div>
  );
}
