import { useState } from 'react';
import { api } from '../../api/client.js';
import { ConnectionBadge, type ConnectionState } from './ConnectionBadge.js';

export interface ServiceField { name: string; label: string; type?: 'text' | 'password' | 'url'; }

export function ServiceGroup({
  title,
  kind,
  values,
  fields,
  onChange,
}: {
  title: string;
  kind: 'plex' | 'tdarr' | 'smartkanban';
  values: Record<string, string>;
  fields: ServiceField[];
  onChange: (v: Record<string, string>) => void;
}) {
  const [conn, setConn] = useState<{ state: ConnectionState; message?: string }>({
    state: 'idle',
  });

  async function test() {
    if (!values.url) {
      setConn({ state: 'error', message: 'url is empty' });
      return;
    }
    setConn({ state: 'testing' });
    try {
      const r = await api.testService(kind, values);
      setConn(r.ok ? { state: 'ok' } : { state: 'error', ...(r.error !== undefined ? { message: r.error } : {}) });
    } catch (e) {
      setConn({ state: 'error', message: (e as Error).message });
    }
  }

  return (
    <div className="border rounded p-3 mb-2 bg-white/50">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-md font-semibold">{title}</h3>
        <button className="px-3 py-1 border rounded ml-auto" onClick={test}>
          Test
        </button>
        <ConnectionBadge state={conn.state} {...(conn.message !== undefined ? { message: conn.message } : {})} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <label key={f.name} className="flex flex-col text-xs">
            <span className="opacity-70">{f.label}</span>
            <input
              className="border px-2 py-1 rounded"
              type={f.type ?? 'text'}
              value={values[f.name] ?? ''}
              onChange={(e) => onChange({ ...values, [f.name]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
