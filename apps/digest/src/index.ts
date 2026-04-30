#!/usr/bin/env tsx
import { ConfigStore } from '@tpd/backend/config-store.js';
import { CheckpointStore } from './checkpoint.js';
import { runDigest } from './digest.js';

async function main() {
  const configFile = process.env.CONFIG_FILE ?? './apps/backend/data/config.json';
  const checkpointFile = process.env.CHECKPOINT_FILE ?? './apps/digest/data/last-run.json';

  const store = new ConfigStore(configFile);
  const cfg = await store.load();
  const checkpoint = new CheckpointStore(checkpointFile);

  const r = await runDigest({ cfg, checkpoint });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(r));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(`digest error: ${(e as Error).message}`);
  process.exit(0);
});
