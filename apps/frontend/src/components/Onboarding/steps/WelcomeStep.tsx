export function WelcomeStep() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Welcome to TranscodePipelineDash</h2>
      <p className="text-sm opacity-80 mb-2">
        Let's set up your environment. We'll walk through your media sources, libraries,
        Plex / Tdarr / SmartKanban services, and encode targets. You can change anything
        later from the Settings page.
      </p>
      <p className="text-sm opacity-60">Click <b>Next</b> to continue.</p>
    </div>
  );
}
