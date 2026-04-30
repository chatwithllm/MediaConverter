import type { Config } from '@tpd/shared';
import { ServiceGroup } from '../../Settings/ServiceGroup.js';

export function SmartKanbanStep({
  config,
  onChange,
}: { config: Config; onChange: (c: Config) => void; }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Step 5 — SmartKanban (optional)</h2>
      <p className="text-sm opacity-80 mb-3">
        Skip if you don't use SmartKanban. Otherwise paste your URL, an api-scoped token,
        and the id of the card that should receive hourly digest activity entries.
      </p>
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
          onChange({
            ...config,
            smartKanban: {
              url: v.url ?? '',
              token: v.token ?? '',
              digestCardId: v.digestCardId ?? '',
            },
          })
        }
      />
    </div>
  );
}
