import type { FastifyInstance } from 'fastify';
import { ConfigSchema } from '@tpd/shared';
import type { ConfigStore } from '../config-store.js';
import { InvalidConfigError } from '../lib/errors.js';

export function configRoutes(store: ConfigStore) {
  return async function (app: FastifyInstance) {
    app.get('/api/config', async () => store.load());

    app.put('/api/config', async (req, reply) => {
      const parsed = ConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid config', issues: parsed.error.issues });
      }
      try {
        await store.save(parsed.data);
        return parsed.data;
      } catch (e) {
        if (e instanceof InvalidConfigError) {
          return reply.code(400).send({ error: e.message });
        }
        throw e;
      }
    });
  };
}
