import { useEffect, useState } from 'react';
import type { PipelineEvent } from '@tpd/shared';
import { pipelineStore } from '../state/pipelineStore.js';

export type StreamStatus = 'connecting' | 'open' | 'closed';

export function useEventStream(): {
  snapshot: Map<string, PipelineEvent>;
  status: StreamStatus;
} {
  const [snap, setSnap] = useState<Map<string, PipelineEvent>>(() =>
    pipelineStore.snapshot(),
  );
  const [status, setStatus] = useState<StreamStatus>('connecting');

  useEffect(() => {
    const unsub = pipelineStore.subscribe(setSnap);
    const es = new EventSource('/api/events');
    es.onopen = () => setStatus('open');
    es.onerror = () => setStatus('closed');

    const handler = (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data) as PipelineEvent;
        pipelineStore.apply(ev);
      } catch {
        /* ignore malformed */
      }
    };

    es.addEventListener('snapshot', handler as EventListener);
    es.addEventListener('pipeline', handler as EventListener);

    return () => {
      unsub();
      es.close();
    };
  }, []);

  return { snapshot: snap, status };
}
