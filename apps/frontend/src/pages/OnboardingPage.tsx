import { useEffect, useState } from 'react';
import type { Config } from '@tpd/shared';
import { api } from '../api/client.js';
import { OnboardingWizard } from '../components/Onboarding/OnboardingWizard.js';

export function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => { api.getConfig().then(setConfig); }, []);
  if (!config) return <div>Loading…</div>;
  return <OnboardingWizard initial={config} onComplete={onComplete} />;
}
