import type { Config } from '@tpd/shared';
import { ServiceGroup } from '../../Settings/ServiceGroup.js';

export function PlexStep({
  config,
  onChange,
}: { config: Config; onChange: (c: Config) => void; }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Step 3 — Plex</h2>
      <ServiceGroup
        title="Plex Media Server"
        kind="plex"
        values={{ url: config.plex.url, token: config.plex.token }}
        fields={[
          { name: 'url', label: 'Plex URL', type: 'url' },
          { name: 'token', label: 'X-Plex-Token', type: 'password' },
        ]}
        onChange={(v) => onChange({ ...config, plex: { url: v.url ?? '', token: v.token ?? '' } })}
      />
    </div>
  );
}
