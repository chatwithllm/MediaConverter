import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ConfigStore } from './config-store.js';
import { healthRoutes } from './routes/health.js';
import { configRoutes } from './routes/config.js';
import { sourceRoutes } from './routes/sources.js';
import { serviceRoutes } from './routes/services.js';
import { logger } from './lib/logger.js';
import { readEnv } from './env.js';

export interface BuildOptions {
  configFile: string;
}

export async function buildApp(opts: BuildOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  await app.register(cors, { origin: true });
  const store = new ConfigStore(opts.configFile);
  await app.register(healthRoutes);
  await app.register(configRoutes(store));
  await app.register(sourceRoutes);
  await app.register(serviceRoutes);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = readEnv();
  buildApp({ configFile: env.configFile })
    .then((app) => app.listen({ port: env.port, host: '0.0.0.0' }))
    .then((addr) => logger.info(`listening on ${addr}`))
    .catch((err) => {
      logger.error(err);
      process.exit(1);
    });
}
