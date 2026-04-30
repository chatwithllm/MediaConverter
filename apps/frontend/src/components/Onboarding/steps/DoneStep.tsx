import type { Config } from '@tpd/shared';

export function DoneStep({ config }: { config: Config }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">All set</h2>
      <p className="text-sm opacity-80 mb-2">
        Review what you configured. Click <b>Finish</b> to save and continue to the dashboard.
      </p>
      <ul className="text-sm space-y-1">
        <li>Sources: <b>{config.sources.length}</b></li>
        <li>Libraries: <b>{config.libraries.length}</b></li>
        <li>Plex: <b>{config.plex.url || '(not set)'}</b></li>
        <li>Tdarr: <b>{config.tdarr.url || '(not set)'}</b></li>
        <li>SmartKanban: <b>{config.smartKanban.url || '(not set)'}</b></li>
        <li>4K HEVC variant: <b>{config.encodeTargets.enable4kHevcVariant ? 'on' : 'off'}</b></li>
        <li>1080p SDR variant: <b>{config.encodeTargets.enable1080pSdrVariant ? 'on' : 'off'}</b></li>
      </ul>
    </div>
  );
}
