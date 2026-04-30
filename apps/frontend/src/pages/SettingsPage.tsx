import { useEffect, useState } from 'react';
import type { Config } from '@tpd/shared';
import { api } from '../api/client.js';
import { SourcesList } from '../components/Settings/SourcesList.js';
import { LibrariesList } from '../components/Settings/LibrariesList.js';
import { ServiceGroup } from '../components/Settings/ServiceGroup.js';
import { EncodeTargets } from '../components/Settings/EncodeTargets.js';

export function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
      setSavedAt(Date.now());
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SourcesList
        sources={config.sources}
        onChange={(sources) => setConfig({ ...config, sources })}
      />
      <LibrariesList
        libraries={config.libraries}
        sources={config.sources}
        onChange={(libraries) => setConfig({ ...config, libraries })}
      />
      <ServiceGroup
        title="Plex"
        kind="plex"
        values={{ url: config.plex.url, token: config.plex.token }}
        fields={[
          { name: 'url', label: 'Plex URL', type: 'url' },
          { name: 'token', label: 'X-Plex-Token', type: 'password' },
        ]}
        onChange={(v) => setConfig({ ...config, plex: { url: v.url ?? '', token: v.token ?? '' } })}
      />
      <ServiceGroup
        title="Tdarr"
        kind="tdarr"
        values={{ url: config.tdarr.url, apiKey: config.tdarr.apiKey }}
        fields={[
          { name: 'url', label: 'Tdarr Server URL', type: 'url' },
          { name: 'apiKey', label: 'API key (if enabled)', type: 'password' },
        ]}
        onChange={(v) => setConfig({ ...config, tdarr: { url: v.url ?? '', apiKey: v.apiKey ?? '' } })}
      />
      <ServiceGroup
        title="SmartKanban"
        kind="smartkanban"
        values={{
          url: config.smartKanban.url,
          token: config.smartKanban.token,
          digestCardId: config.smartKanban.digestCardId,
        }}
        fields={[
          { name: 'url', label: 'SmartKanban URL', type: 'url' },
          { name: 'token', label: 'API token', type: 'password' },
          { name: 'digestCardId', label: 'Digest card id' },
        ]}
        onChange={(v) =>
          setConfig({
            ...config,
            smartKanban: { url: v.url ?? '', token: v.token ?? '', digestCardId: v.digestCardId ?? '' },
          })
        }
      />
      <EncodeTargets
        values={config.encodeTargets}
        onChange={(encodeTargets) => setConfig({ ...config, encodeTargets })}
      />
      <div className="flex items-center gap-3">
        <button
          className="px-4 py-2 bg-accent text-white rounded"
          disabled={saving}
          onClick={save}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saveError && <span className="text-danger text-sm">{saveError}</span>}
        {!saveError && savedAt && (
          <span className="text-xs opacity-60">Saved {new Date(savedAt).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
