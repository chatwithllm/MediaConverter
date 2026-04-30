import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SourceConfigByType, SOURCE_TYPES } from '@tpd/shared';
import { driverRegistry } from '../drivers/index.js';

const TestBody = z.object({ type: z.enum(SOURCE_TYPES), config: z.unknown() });
const ListBody = TestBody.extend({ subPath: z.string() });

export async function sourceRoutes(app: FastifyInstance) {
  app.post('/api/sources/test', async (req, reply) => {
    const parsed = TestBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { type, config } = parsed.data;
    const schema = SourceConfigByType[type];
    const sc = schema.safeParse(config);
    if (!sc.success) return { ok: false, error: sc.error.message };
    return await driverRegistry[type].validate(sc.data);
  });

  app.post('/api/sources/list', async (req, reply) => {
    const parsed = ListBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { type, config, subPath } = parsed.data;
    const driver = driverRegistry[type];
    if (!driver.list) {
      return reply.code(400).send({ error: `driver "${type}" does not support list` });
    }
    const schema = SourceConfigByType[type];
    const sc = schema.safeParse(config);
    if (!sc.success) return reply.code(400).send({ error: sc.error.message });
    return await driver.list(sc.data, subPath);
  });
}
