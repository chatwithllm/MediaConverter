import { useState } from 'react';
import type { Source } from '@tpd/shared';
import { api } from '../../api/client.js';
import { ConnectionBadge, type ConnectionState } from './ConnectionBadge.js';

export function SourceRow({
  source,
  onChange,
  onRemove,
}: {
  source: Source;
  onChange: (s: Source) => void;
  onRemove: () => void;
}) {
  const [conn, setConn] = useState<{ state: ConnectionState; message?: string }>({
    state: 'idle',
  });

  async function test() {
    setConn({ state: 'testing' });
    try {
      const r = await api.testSource(source.type, source.config);
      setConn(r.error !== undefined
        ? { state: r.ok ? 'ok' : 'error', message: r.error }
        : { state: r.ok ? 'ok' : 'error' });
    } catch (e) {
      setConn({ state: 'error', message: (e as Error).message });
    }
  }

  return (
    <div className="border rounded p-3 mb-2 bg-white/50">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="border px-2 py-1 rounded"
          placeholder="Label"
          value={source.label}
          onChange={(e) => onChange({ ...source, label: e.target.value })}
        />
        <select
          className="border px-2 py-1 rounded"
          value={source.type}
          onChange={(e) => {
            const type = e.target.value as Source['type'];
            const config = type === 'local' ? { path: '' } : {};
            onChange({ ...source, type, config } as Source);
          }}
        >
          <option value="local">local</option>
          <option value="truenas" disabled>truenas (3b)</option>
          <option value="smb" disabled>smb (3b)</option>
          <option value="nfs" disabled>nfs (3b)</option>
          <option value="rclone" disabled>rclone (3b)</option>
        </select>
        {source.type === 'local' && (
          <input
            className="border px-2 py-1 rounded grow"
            placeholder="/absolute/path"
            value={(source.config as { path: string }).path}
            onChange={(e) =>
              onChange({ ...source, config: { path: e.target.value } } as Source)
            }
          />
        )}
        <button className="px-3 py-1 border rounded" onClick={test}>
          Test
        </button>
        <ConnectionBadge state={conn.state} {...(conn.message !== undefined ? { message: conn.message } : {})} />
        <button className="px-3 py-1 border rounded text-danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}
