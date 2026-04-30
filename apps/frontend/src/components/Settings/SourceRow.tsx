import { useState } from 'react';
import type { Source } from '@tpd/shared';
import { api } from '../../api/client.js';
import { ConnectionBadge, type ConnectionState } from './ConnectionBadge.js';

const SOURCE_TYPE_OPTIONS: Array<{ value: Source['type']; disabled?: boolean }> = [
  { value: 'local' },
  { value: 'truenas' },
  { value: 'smb' },
  { value: 'nfs' },
  { value: 'rclone', disabled: true },
];

function defaultConfigFor(type: Source['type']): Source['config'] {
  switch (type) {
    case 'local':
      return { path: '' };
    case 'smb':
      return { host: '', share: '', username: '', password: '' };
    case 'truenas':
      return { host: '', share: '', username: '', password: '' };
    case 'nfs':
      return { host: '', exportPath: '', version: '4' };
    case 'rclone':
      return { remote: '' };
  }
}

interface FieldDef { name: string; label: string; type?: 'text' | 'password' | 'number' | 'select'; options?: string[]; }

const FIELDS_BY_TYPE: Record<Source['type'], FieldDef[]> = {
  local: [{ name: 'path', label: 'Path' }],
  smb: [
    { name: 'host', label: 'Host' },
    { name: 'share', label: 'Share' },
    { name: 'username', label: 'Username' },
    { name: 'password', label: 'Password', type: 'password' },
    { name: 'domain', label: 'Domain (optional)' },
  ],
  truenas: [
    { name: 'host', label: 'TrueNAS host' },
    { name: 'share', label: 'SMB share' },
    { name: 'username', label: 'Username' },
    { name: 'password', label: 'Password', type: 'password' },
  ],
  nfs: [
    { name: 'host', label: 'Host' },
    { name: 'exportPath', label: 'Export path' },
    { name: 'version', label: 'NFS version', type: 'select', options: ['3', '4'] },
  ],
  rclone: [{ name: 'remote', label: 'Rclone remote' }],
};

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
      setConn(r.ok ? { state: 'ok' } : { state: 'error', ...(r.error !== undefined ? { message: r.error } : {}) });
    } catch (e) {
      setConn({ state: 'error', message: (e as Error).message });
    }
  }

  const fields = FIELDS_BY_TYPE[source.type];
  const cfg = source.config as Record<string, string>;

  return (
    <div className="border rounded p-3 mb-2 bg-white/50">
      <div className="flex items-center gap-2 flex-wrap mb-2">
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
            onChange({ ...source, type, config: defaultConfigFor(type) } as Source);
          }}
        >
          {SOURCE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.value}
              {opt.disabled ? ' (3c)' : ''}
            </option>
          ))}
        </select>
        <button className="px-3 py-1 border rounded" onClick={test}>
          Test
        </button>
        <ConnectionBadge state={conn.state} {...(conn.message !== undefined ? { message: conn.message } : {})} />
        <button className="px-3 py-1 border rounded text-danger ml-auto" onClick={onRemove}>
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => {
          const value = cfg[f.name] ?? '';
          if (f.type === 'select' && f.options) {
            return (
              <label key={f.name} className="flex flex-col text-xs">
                <span className="opacity-70">{f.label}</span>
                <select
                  className="border px-2 py-1 rounded"
                  value={value}
                  onChange={(e) =>
                    onChange({
                      ...source,
                      config: { ...cfg, [f.name]: e.target.value },
                    } as Source)
                  }
                >
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
            );
          }
          return (
            <label key={f.name} className="flex flex-col text-xs">
              <span className="opacity-70">{f.label}</span>
              <input
                className="border px-2 py-1 rounded"
                type={f.type ?? 'text'}
                value={value}
                onChange={(e) =>
                  onChange({
                    ...source,
                    config: { ...cfg, [f.name]: e.target.value },
                  } as Source)
                }
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
