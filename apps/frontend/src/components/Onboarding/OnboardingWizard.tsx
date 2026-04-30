import { useState } from 'react';
import type { Config } from '@tpd/shared';
import { api } from '../../api/client.js';
import { WelcomeStep } from './steps/WelcomeStep.js';
import { SourcesStep } from './steps/SourcesStep.js';
import { LibrariesStep } from './steps/LibrariesStep.js';
import { PlexStep } from './steps/PlexStep.js';
import { TdarrStep } from './steps/TdarrStep.js';
import { SmartKanbanStep } from './steps/SmartKanbanStep.js';
import { EncodeTargetsStep } from './steps/EncodeTargetsStep.js';
import { DoneStep } from './steps/DoneStep.js';

const STEPS = [
  'welcome',
  'sources',
  'libraries',
  'plex',
  'tdarr',
  'smartkanban',
  'encode',
  'done',
] as const;
type StepName = (typeof STEPS)[number];

export function OnboardingWizard({
  initial,
  onComplete,
}: {
  initial: Config;
  onComplete: () => void;
}) {
  const [draft, setDraft] = useState<Config>(initial);
  const [stepIdx, setStepIdx] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const step: StepName = STEPS[stepIdx]!;
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;

  async function finish() {
    setFinishing(true);
    setFinishError(null);
    try {
      await api.putConfig({ ...draft, onboardingComplete: true });
      onComplete();
    } catch (e) {
      setFinishError((e as Error).message);
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={
              'text-xs px-2 py-1 rounded ' +
              (i === stepIdx
                ? 'bg-accent text-white'
                : i < stepIdx
                  ? 'bg-accent-bright/30'
                  : 'bg-ink/10 opacity-60')
            }
          >
            {s}
          </span>
        ))}
      </div>

      <div className="bg-white/60 border rounded p-4 mb-4">
        {step === 'welcome' && <WelcomeStep />}
        {step === 'sources' && (
          <SourcesStep config={draft} onChange={setDraft} />
        )}
        {step === 'libraries' && (
          <LibrariesStep config={draft} onChange={setDraft} />
        )}
        {step === 'plex' && (
          <PlexStep config={draft} onChange={setDraft} />
        )}
        {step === 'tdarr' && (
          <TdarrStep config={draft} onChange={setDraft} />
        )}
        {step === 'smartkanban' && (
          <SmartKanbanStep config={draft} onChange={setDraft} />
        )}
        {step === 'encode' && (
          <EncodeTargetsStep config={draft} onChange={setDraft} />
        )}
        {step === 'done' && <DoneStep config={draft} />}
      </div>

      <div className="flex items-center gap-3">
        <button
          className="px-4 py-2 border rounded"
          disabled={isFirst}
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
        >
          Back
        </button>
        {!isLast ? (
          <button
            className="px-4 py-2 bg-accent text-white rounded"
            onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
          >
            Next
          </button>
        ) : (
          <button
            className="px-4 py-2 bg-accent text-white rounded"
            disabled={finishing}
            onClick={finish}
          >
            {finishing ? 'Saving…' : 'Finish'}
          </button>
        )}
        {finishError && <span className="text-danger text-sm">{finishError}</span>}
      </div>
    </div>
  );
}
