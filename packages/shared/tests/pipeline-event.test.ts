import { describe, it, expect } from 'vitest';
import { PipelineEventSchema } from '../src/pipeline-event.js';

describe('PipelineEventSchema', () => {
  it('accepts minimal valid event', () => {
    const e = PipelineEventSchema.parse({
      fileId: 'f1', title: 'Dune', stage: 'queued', ts: Date.now(),
    });
    expect(e.stage).toBe('queued');
  });
  it('rejects unknown stage', () => {
    expect(() =>
      PipelineEventSchema.parse({ fileId: 'f1', title: 'x', stage: 'bogus', ts: 1 }),
    ).toThrow();
  });
  it('rejects progress > 1', () => {
    expect(() =>
      PipelineEventSchema.parse({
        fileId: 'f1', title: 'x', stage: 'encoding', progress: 1.5, ts: 1,
      }),
    ).toThrow();
  });
});
