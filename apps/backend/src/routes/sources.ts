import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SourceConfigByType, SOURCE_TYPES } from '@tpd/shared';
import { LocalDriver } from '../drivers/local.js';

const TestBody = z.object({
  type: z.enum(SOURCE_TYPES),
  config: z.unknown(),
});

const ListBody = TestBody.extend({
  subPath: z.string(),
});

export async function sourceRoutes(app: FastifyInstance) {
  app.post('/api/sources/test', async (req, reply) => {
    const parsed = TestBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { type, config } = parsed.data;
    if (type !== 'local') {
      return { ok: false, error: `driver "${type}" not yet implemented in 3a` };
    }
    const lc = SourceConfigByType.local.safeParse(config);
    if (!lc.success) return { ok: false, error: lc.error.message };
    return await LocalDriver.validate(lc.data);
  });

  app.post('/api/sources/list', async (req, reply) => {
    const parsed = ListBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { type, config, subPath } = parsed.data;
    if (type !== 'local') {
      return reply.code(400).send({ error: `driver "${type}" not yet implemented in 3a` });
    }
    const lc = SourceConfigByType.local.safeParse(config);
    if (!lc.success) return reply.code(400).send({ error: lc.error.message });
    return await LocalDriver.list(lc.data, subPath);
  });
}
