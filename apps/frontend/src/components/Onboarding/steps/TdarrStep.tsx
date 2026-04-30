import type { Config } from '@tpd/shared';
import { ServiceGroup } from '../../Settings/ServiceGroup.js';

export function TdarrStep({
  config,
  onChange,
}: { config: Config; onChange: (c: Config) => void; }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Step 4 — Tdarr</h2>
      <ServiceGroup
        title="Tdarr Server"
        kind="tdarr"
        values={{ url: config.tdarr.url, apiKey: config.tdarr.apiKey }}
        fields={[
          { name: 'url', label: 'Tdarr Server URL', type: 'url' },
          { name: 'apiKey', label: 'API key (if enabled)', type: 'password' },
        ]}
        onChange={(v) =>
          onChange({ ...config, tdarr: { url: v.url ?? '', apiKey: v.apiKey ?? '' } })
        }
      />
    </div>
  );
}
