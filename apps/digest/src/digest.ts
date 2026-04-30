import type { Config } from '@tpd/shared';
import { TdarrClient } from '@tpd/backend/clients/tdarr.js';
import type { TdarrJob } from '@tpd/backend/clients/tdarr.js';
import { SmartKanbanClient } from './smartkanban-client.js';
import { CheckpointStore } from './checkpoint.js';

export interface DigestRunResult {
  posted: boolean;
  done: number;
  failed: number;
  reason?: string;
}

export interface DigestDeps {
  cfg: Config;
  checkpoint: CheckpointStore;
  tdarrFactory?: (url: string, key?: string) => { getHistory: (sinceTs: number) => Promise<TdarrJob[]> };
  smartKanbanFactory?: (url: string, token: string) => Pick<SmartKanbanClient, 'postActivity'>;
  now?: () => number;
}

export async function runDigest(deps: DigestDeps): Promise<DigestRunResult> {
  const { cfg, checkpoint } = deps;
  const now = deps.now ? deps.now() : Date.now();
  if (!cfg.tdarr.url) {
    return { posted: false, done: 0, failed: 0, reason: 'tdarr.url not set' };
  }
  if (!cfg.smartKanban.url || !cfg.smartKanban.token || !cfg.smartKanban.digestCardId) {
    return { posted: false, done: 0, failed: 0, reason: 'smartKanban not fully configured' };
  }

  const lastRunTs = await checkpoint.load();
  const tdarr = (deps.tdarrFactory ?? ((u, k) => new TdarrClient(u, k)))(
    cfg.tdarr.url,
    cfg.tdarr.apiKey || undefined,
  );

  let history: TdarrJob[] = [];
  try {
    history = await tdarr.getHistory(lastRunTs);
  } catch (e) {
    return { posted: false, done: 0, failed: 0, reason: `tdarr error: ${(e as Error).message}` };
  }

  const done = history.filter((h) => h.status === 'success').length;
  const failed = history.filter((h) => h.status === 'error' || h.status === 'cancelled').length;

  if (done === 0 && failed === 0) {
    await checkpoint.save(now);
    return { posted: false, done, failed, reason: 'nothing to report' };
  }

  const titles = history
    .filter((h) => h.status === 'success')
    .slice(0, 3)
    .map((h) => h.title || h.file)
    .join(', ');
  const summary = `Last interval: ${done} done${titles ? ` (${titles})` : ''}, ${failed} failed.`;

  const sk = (deps.smartKanbanFactory ?? ((u, t) => new SmartKanbanClient(u, t)))(
    cfg.smartKanban.url,
    cfg.smartKanban.token,
  );
  const r = await sk.postActivity(cfg.smartKanban.digestCardId, summary);

  if (!r.ok) {
    return {
      posted: false,
      done,
      failed,
      reason: `smartkanban ${r.status} ${r.error ?? ''}`.trim(),
    };
  }

  await checkpoint.save(now);
  return { posted: true, done, failed };
}
