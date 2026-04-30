import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export function PathPickerLocal({
  basePath,
  onChange,
}: {
  basePath: string;
  onChange: (p: string) => void;
}) {
  const [subPath, setSubPath] = useState('');
  const [entries, setEntries] = useState<Array<{ name: string; isDirectory: boolean }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listSource('local', { path: basePath }, subPath)
      .then((rows) => {
        if (!cancelled) {
          setEntries(rows);
          setError(null);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [basePath, subPath]);

  return (
    <div className="border rounded p-2 mt-2">
      <div className="text-xs opacity-70 mb-1">basePath: {basePath}</div>
      <div className="text-xs mb-1">subPath: /{subPath}</div>
      {error && <div className="text-danger text-xs">{error}</div>}
      <ul className="text-sm">
        {subPath && (
          <li>
            <button
              className="underline"
              onClick={() => setSubPath(subPath.split('/').slice(0, -1).join('/'))}
            >
              ..
            </button>
          </li>
        )}
        {entries.map((e) => (
          <li key={e.name}>
            {e.isDirectory ? (
              <button
                className="underline"
                onClick={() => setSubPath(subPath ? `${subPath}/${e.name}` : e.name)}
              >
                {e.name}/
              </button>
            ) : (
              <span className="opacity-60">{e.name}</span>
            )}
          </li>
        ))}
      </ul>
      <button
        className="mt-2 px-3 py-1 bg-accent text-white rounded"
        onClick={() => onChange(subPath)}
      >
        Use this path
      </button>
    </div>
  );
}
