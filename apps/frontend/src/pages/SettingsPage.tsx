import { useEffect, useState } from 'react';
import type { Config } from '@tpd/shared';
import { api } from '../api/client.js';
import { SourcesList } from '../components/Settings/SourcesList.js';

export function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    api.getConfig().then(setConfig);
  }, []);

  if (!config) return <div>Loading…</div>;

  async function save() {
    if (!config) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await api.putConfig(config);
      setConfig(next);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SourcesList
        sources={config.sources}
        onChange={(sources) => setConfig({ ...config, sources })}
      />
      <div className="mt-6 flex items-center gap-3">
        <button
          className="px-4 py-2 bg-accent text-white rounded"
          disabled={saving}
          onClick={save}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saveError && <span className="text-danger text-sm">{saveError}</span>}
      </div>
    </div>
  );
}
