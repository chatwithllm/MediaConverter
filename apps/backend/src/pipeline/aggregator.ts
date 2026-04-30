import { EventEmitter } from 'node:events';
import type { PipelineEvent, PipelineStage } from '@tpd/shared';
import { TdarrClient, type TdarrJob } from '../clients/tdarr.js';
import { PlexClient } from '../clients/plex.js';

export interface AggregatorConfig {
  tdarrUrl: string;
  tdarrApiKey?: string;
  plexUrl?: string;
  plexToken?: string;
  pollTdarrMs?: number;
  pollPlexMs?: number;
}

function tdarrStatusToStage(s: string): PipelineStage {
  if (s === 'queued') return 'queued';
  if (s === 'processing') return 'encoding';
  if (s === 'success') return 'verifying';
  if (s === 'error' || s === 'cancelled') return 'failed';
  return 'discovered';
}

export class Aggregator extends EventEmitter {
  private snapshot = new Map<string, PipelineEvent>();
  private timers: NodeJS.Timeout[] = [];
  private tdarr: TdarrClient;
  private plex?: PlexClient;

  constructor(private cfg: AggregatorConfig) {
    super();
    this.tdarr = new TdarrClient(cfg.tdarrUrl, cfg.tdarrApiKey);
    if (cfg.plexUrl && cfg.plexToken) {
      this.plex = new PlexClient(cfg.plexUrl, cfg.plexToken);
    }
  }

  start() {
    const tdarrInterval = this.cfg.pollTdarrMs ?? 5000;
    const plexInterval = this.cfg.pollPlexMs ?? 30000;
    this.timers.push(setInterval(() => this.pollTdarr().catch(() => {}), tdarrInterval));
    if (this.plex) {
      this.timers.push(setInterval(() => this.pollPlex().catch(() => {}), plexInterval));
    }
    void this.pollTdarr().catch(() => {});
    if (this.plex) void this.pollPlex().catch(() => {});
  }

  stop() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  getSnapshot(): PipelineEvent[] {
    return Array.from(this.snapshot.values());
  }

  private emitEvent(e: PipelineEvent) {
    this.snapshot.set(e.fileId, e);
    this.emit('event', e);
  }

  private async pollTdarr() {
    const s = await this.tdarr.getStatus();
    const all: TdarrJob[] = [...s.queue, ...s.workers];
    for (const j of all) {
      const fileId = j._id;
      const title = j.title ?? j.origLibraryFile?.file ?? j.file ?? fileId;
      const stage = tdarrStatusToStage(j.status);
      const ev: PipelineEvent = {
        fileId,
        title,
        stage,
        ts: Date.now(),
        ...(j.workerId !== undefined ? { node: j.workerId } : {}),
        ...(j.percentage !== undefined ? { progress: j.percentage / 100 } : {}),
        ...(j.ETA !== undefined ? { etaSeconds: j.ETA } : {}),
      };
      this.emitEvent(ev);
    }
  }

  private async pollPlex() {
    if (!this.plex) return;
    const sections = await this.plex.getSections();
    for (const sec of sections) {
      const recents = await this.plex.getRecentlyAdded(sec.key);
      for (const r of recents) {
        const ev: PipelineEvent = {
          fileId: `plex-${r.ratingKey}`,
          title: r.title,
          stage: 'in_plex',
          ts: r.addedAt * 1000,
        };
        this.emitEvent(ev);
      }
    }
  }
}
