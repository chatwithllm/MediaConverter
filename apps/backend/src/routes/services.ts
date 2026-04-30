import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { httpProbe } from '../lib/http-probe.js';

const PlexBody = z.object({ url: z.string().url(), token: z.string().optional() });
const TdarrBody = z.object({ url: z.string().url(), apiKey: z.string().optional() });
const SmartKanbanBody = z.object({ url: z.string().url(), token: z.string().optional() });

export async function serviceRoutes(app: FastifyInstance) {
  app.post('/api/services/plex/test', async (req, reply) => {
    const parsed = PlexBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { url, token } = parsed.data;
    const probeUrl = `${url.replace(/\/$/, '')}/identity`;
    return await httpProbe({
      url: probeUrl,
      headers: token ? { 'X-Plex-Token': token } : {},
      expectStatusBelow: 400,
    });
  });

  app.post('/api/services/tdarr/test', async (req, reply) => {
    const parsed = TdarrBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { url, apiKey } = parsed.data;
    const probeUrl = `${url.replace(/\/$/, '')}/api/v2/status`;
    return await httpProbe({
      url: probeUrl,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      expectStatusBelow: 400,
    });
  });

  app.post('/api/services/smartkanban/test', async (req, reply) => {
    const parsed = SmartKanbanBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { url, token } = parsed.data;
    const probeUrl = `${url.replace(/\/$/, '')}/api/health`;
    return await httpProbe({
      url: probeUrl,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      expectStatusBelow: 500,
    });
  });
}
