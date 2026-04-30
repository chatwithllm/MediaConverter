import type { Library, Source } from '@tpd/shared';

export function LibraryRow({
  library,
  sources,
  onChange,
  onRemove,
}: {
  library: Library;
  sources: Source[];
  onChange: (l: Library) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border rounded p-3 mb-2 bg-white/50">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="border px-2 py-1 rounded"
          placeholder="Label"
          value={library.label}
          onChange={(e) => onChange({ ...library, label: e.target.value })}
        />
        <select
          className="border px-2 py-1 rounded"
          value={library.sourceId}
          onChange={(e) => onChange({ ...library, sourceId: e.target.value })}
        >
          <option value="">— pick source —</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.label || s.id}</option>
          ))}
        </select>
        <input
          className="border px-2 py-1 rounded grow"
          placeholder="Path within source (e.g. movies)"
          value={library.pathWithinSource}
          onChange={(e) => onChange({ ...library, pathWithinSource: e.target.value })}
        />
        <select
          className="border px-2 py-1 rounded"
          value={library.libraryType}
          onChange={(e) =>
            onChange({ ...library, libraryType: e.target.value as Library['libraryType'] })
          }
        >
          <option value="movie">movie</option>
          <option value="tv">tv</option>
          <option value="other">other</option>
        </select>
        <button className="px-3 py-1 border rounded text-danger ml-auto" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}
