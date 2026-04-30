import type { PipelineEvent } from '@tpd/shared';

type Listener = (snap: Map<string, PipelineEvent>) => void;

const snap = new Map<string, PipelineEvent>();
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l(new Map(snap));
}

export const pipelineStore = {
  apply(ev: PipelineEvent) {
    snap.set(ev.fileId, ev);
    notify();
  },
  reset() {
    snap.clear();
    notify();
  },
  snapshot(): Map<string, PipelineEvent> {
    return new Map(snap);
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
