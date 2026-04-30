import type { Config } from '@tpd/shared';
import { EncodeTargets } from '../../Settings/EncodeTargets.js';

export function EncodeTargetsStep({
  config,
  onChange,
}: { config: Config; onChange: (c: Config) => void; }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Step 6 — Encode targets</h2>
      <p className="text-sm opacity-80 mb-3">
        Pre-encode bitrates and tonemap algorithm. Defaults are sensible for most libraries.
      </p>
      <EncodeTargets
        values={config.encodeTargets}
        onChange={(encodeTargets) => onChange({ ...config, encodeTargets })}
      />
    </div>
  );
}
