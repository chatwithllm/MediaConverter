import { z } from 'zod';

export const PIPELINE_STAGES = [
  'discovered',
  'queued',
  'encoding',
  'verifying',
  'in_plex',
  'failed',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PipelineEventSchema = z.object({
  fileId: z.string().min(1),
  title: z.string(),
  stage: z.enum(PIPELINE_STAGES),
  node: z.string().optional(),
  progress: z.number().min(0).max(1).optional(),
  etaSeconds: z.number().nonnegative().optional(),
  sourceCodec: z.string().optional(),
  targetCodec: z.string().optional(),
  errorMessage: z.string().optional(),
  ts: z.number().int().positive(),
});
export type PipelineEvent = z.infer<typeof PipelineEventSchema>;
