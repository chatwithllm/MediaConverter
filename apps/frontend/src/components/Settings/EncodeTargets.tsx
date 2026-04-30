import type { Config } from '@tpd/shared';

type Targets = Config['encodeTargets'];

export function EncodeTargets({
  values,
  onChange,
}: {
  values: Targets;
  onChange: (v: Targets) => void;
}) {
  return (
    <div className="border rounded p-3 mb-2 bg-white/50">
      <h3 className="text-md font-semibold mb-2">Encode targets</h3>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col text-xs">
          <span className="opacity-70">4K HEVC bitrate (Mbps)</span>
          <input
            type="number"
            className="border px-2 py-1 rounded"
            value={values.hevc4kBitrateMbps}
            onChange={(e) => onChange({ ...values, hevc4kBitrateMbps: Number(e.target.value) })}
          />
        </label>
        <label className="flex flex-col text-xs">
          <span className="opacity-70">1080p H.264 bitrate (Mbps)</span>
          <input
            type="number"
            className="border px-2 py-1 rounded"
            value={values.h2641080pBitrateMbps}
            onChange={(e) => onChange({ ...values, h2641080pBitrateMbps: Number(e.target.value) })}
          />
        </label>
        <label className="flex flex-col text-xs">
          <span className="opacity-70">AAC bitrate (kbps)</span>
          <input
            type="number"
            className="border px-2 py-1 rounded"
            value={values.aacBitrateKbps}
            onChange={(e) => onChange({ ...values, aacBitrateKbps: Number(e.target.value) })}
          />
        </label>
        <label className="flex flex-col text-xs">
          <span className="opacity-70">Tonemap algorithm</span>
          <select
            className="border px-2 py-1 rounded"
            value={values.tonemapAlgorithm}
            onChange={(e) =>
              onChange({ ...values, tonemapAlgorithm: e.target.value as Targets['tonemapAlgorithm'] })
            }
          >
            <option value="hable">hable</option>
            <option value="mobius">mobius</option>
            <option value="reinhard">reinhard</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={values.enable4kHevcVariant}
            onChange={(e) => onChange({ ...values, enable4kHevcVariant: e.target.checked })}
          />
          Enable 4K HEVC variant
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={values.enable1080pSdrVariant}
            onChange={(e) => onChange({ ...values, enable1080pSdrVariant: e.target.checked })}
          />
          Enable 1080p SDR variant
        </label>
      </div>
    </div>
  );
}
