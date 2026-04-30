import type { Config } from '@tpd/shared';
import { SourcesList } from '../../Settings/SourcesList.js';

export function SourcesStep({
  config,
  onChange,
}: { config: Config; onChange: (c: Config) => void; }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Step 1 — Sources</h2>
      <p className="text-sm opacity-80 mb-3">
        A source is any filesystem your encode workers can read and write. Add at least one.
      </p>
      <SourcesList
        sources={config.sources}
        onChange={(sources) => onChange({ ...config, sources })}
      />
    </div>
  );
}
