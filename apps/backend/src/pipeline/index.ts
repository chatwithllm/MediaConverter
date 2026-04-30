import type { Config } from '@tpd/shared';
import { Aggregator } from './aggregator.js';
import { MockAggregator } from './mock.js';

export type AnyAggregator = Aggregator | MockAggregator;

export function pickAggregator(env: { mock: boolean }, cfg: Config): AnyAggregator {
  if (env.mock) return new MockAggregator();
  return new Aggregator({
    tdarrUrl: cfg.tdarr.url,
    ...(cfg.tdarr.apiKey ? { tdarrApiKey: cfg.tdarr.apiKey } : {}),
    ...(cfg.plex.url ? { plexUrl: cfg.plex.url } : {}),
    ...(cfg.plex.token ? { plexToken: cfg.plex.token } : {}),
  });
}
