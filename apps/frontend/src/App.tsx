import { useEffect, useState } from 'react';
import type { Config } from '@tpd/shared';
import { api } from './api/client.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { OnboardingPage } from './pages/OnboardingPage.js';
import { FlowPage } from './pages/FlowPage.js';

type Tab = 'flow' | 'settings';

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>('flow');

  useEffect(() => {
    api.getConfig().then(setConfig);
  }, [reloadKey]);

  if (!config) return <div className="min-h-screen p-6">Loading…</div>;

  if (!config.onboardingComplete) {
    return (
      <div className="min-h-screen p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-accent">TranscodePipelineDash</h1>
        </header>
        <OnboardingPage onComplete={() => setReloadKey((k) => k + 1)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-accent">TranscodePipelineDash</h1>
        <nav className="flex gap-1 ml-auto">
          {(['flow', 'settings'] as const).map((t) => (
            <button
              key={t}
              className={
                'text-sm px-3 py-1 rounded ' +
                (tab === t ? 'bg-accent text-white' : 'bg-ink/10 hover:bg-ink/15')
              }
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
          <button
            className="text-xs underline opacity-70 hover:opacity-100 ml-2"
            onClick={async () => {
              await api.putConfig({ ...config, onboardingComplete: false } as Config);
              setReloadKey((k) => k + 1);
            }}
          >
            Re-run onboarding
          </button>
        </nav>
      </header>
      <main>{tab === 'flow' ? <FlowPage /> : <SettingsPage />}</main>
    </div>
  );
}
