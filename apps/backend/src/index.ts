import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ConfigStore } from './config-store.js';
import { healthRoutes } from './routes/health.js';
import { configRoutes } from './routes/config.js';
import { sourceRoutes } from './routes/sources.js';
import { serviceRoutes } from './routes/services.js';
import { eventsRoutes } from './routes/events.js';
import { logger } from './lib/logger.js';
import { readEnv } from './env.js';
import { pickAggregator, type AnyAggregator } from './pipeline/index.js';

export interface BuildOptions {
  configFile: string;
  mock?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    aggregator: AnyAggregator;
  }
}

export async function buildApp(opts: BuildOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  await app.register(cors, { origin: true });
  const store = new ConfigStore(opts.configFile);
  const cfg = await store.load();
  const aggregator = pickAggregator({ mock: !!opts.mock }, cfg);
  app.decorate('aggregator', aggregator);
  aggregator.start();
  app.addHook('onClose', async () => aggregator.stop());

  await app.register(healthRoutes);
  await app.register(configRoutes(store));
  await app.register(sourceRoutes);
  await app.register(serviceRoutes);
  await app.register(eventsRoutes);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = readEnv();
  buildApp({ configFile: env.configFile, mock: env.mock })
    .then((app) => app.listen({ port: env.port, host: '0.0.0.0' }))
    .then((addr) => logger.info(`listening on ${addr}`))
    .catch((err) => {
      logger.error(err);
      process.exit(1);
    });
}
