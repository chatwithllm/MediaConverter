import type { Config } from '@tpd/shared';
import { LibrariesList } from '../../Settings/LibrariesList.js';

export function LibrariesStep({
  config,
  onChange,
}: { config: Config; onChange: (c: Config) => void; }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Step 2 — Libraries</h2>
      <p className="text-sm opacity-80 mb-3">
        Map source paths to Plex libraries. One row per Plex library section.
      </p>
      <LibrariesList
        libraries={config.libraries}
        sources={config.sources}
        onChange={(libraries) => onChange({ ...config, libraries })}
      />
    </div>
  );
}
