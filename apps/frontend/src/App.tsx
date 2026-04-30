import { useEffect, useState } from 'react';
import type { Config } from '@tpd/shared';
import { api } from './api/client.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { OnboardingPage } from './pages/OnboardingPage.js';

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.getConfig().then(setConfig);
  }, [reloadKey]);

  if (!config) {
    return <div className="min-h-screen p-6">Loading…</div>;
  }

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-accent">TranscodePipelineDash</h1>
        {config.onboardingComplete && (
          <button
            className="text-xs underline opacity-70 hover:opacity-100"
            onClick={async () => {
              await api.putConfig({ ...config, onboardingComplete: false });
              setReloadKey((k) => k + 1);
            }}
          >
            Re-run onboarding
          </button>
        )}
      </header>
      <main>
        {config.onboardingComplete ? (
          <SettingsPage />
        ) : (
          <OnboardingPage onComplete={() => setReloadKey((k) => k + 1)} />
        )}
      </main>
    </div>
  );
}
