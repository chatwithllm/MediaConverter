import { EventEmitter } from 'node:events';
import type { PipelineEvent, PipelineStage } from '@tpd/shared';

const STAGES: PipelineStage[] = ['discovered', 'queued', 'encoding', 'verifying', 'in_plex'];

export class MockAggregator extends EventEmitter {
  private interval?: NodeJS.Timeout;
  private snap = new Map<string, PipelineEvent>();

  start() {
    let tick = 0;
    const titles = ['Dune (2021)', 'Tenet (2020)', 'Severance S02E03'];
    this.interval = setInterval(() => {
      titles.forEach((title, i) => {
        const stage = STAGES[(tick + i) % STAGES.length]!;
        const ev: PipelineEvent = {
          fileId: `mock-${i}`,
          title,
          stage,
          ts: Date.now(),
          ...(stage === 'encoding' ? { node: i % 2 === 0 ? 'M4' : 'M1' } : {}),
          ...(stage === 'encoding' ? { progress: (tick % 5) / 5 } : {}),
          ...(stage === 'encoding' ? { etaSeconds: 60 } : {}),
        };
        this.snap.set(ev.fileId, ev);
        this.emit('event', ev);
      });
      tick += 1;
    }, 3000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
  }

  getSnapshot(): PipelineEvent[] {
    return Array.from(this.snap.values());
  }
}
