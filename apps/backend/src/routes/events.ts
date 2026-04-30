import type { FastifyInstance } from 'fastify';
import type { PipelineEvent } from '@tpd/shared';

export async function eventsRoutes(app: FastifyInstance) {
  app.get('/api/events', (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();

    const agg = app.aggregator;

    for (const ev of agg.getSnapshot()) {
      reply.raw.write(`event: snapshot\ndata: ${JSON.stringify(ev)}\n\n`);
    }

    const onEvent = (ev: PipelineEvent) => {
      reply.raw.write(`event: pipeline\ndata: ${JSON.stringify(ev)}\n\n`);
    };
    agg.on('event', onEvent);

    const heartbeat = setInterval(() => {
      reply.raw.write(': hb\n\n');
    }, 15000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      agg.off('event', onEvent);
      reply.raw.end();
    });
  });
}
