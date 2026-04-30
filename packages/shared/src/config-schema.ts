import { z } from 'zod';
import { SourceConfigByType } from './source-types.js';

const baseSource = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const SourceSchema = z.discriminatedUnion('type', [
  baseSource.extend({ type: z.literal('local'), config: SourceConfigByType.local }),
  baseSource.extend({ type: z.literal('truenas'), config: SourceConfigByType.truenas }),
  baseSource.extend({ type: z.literal('smb'), config: SourceConfigByType.smb }),
  baseSource.extend({ type: z.literal('nfs'), config: SourceConfigByType.nfs }),
  baseSource.extend({ type: z.literal('rclone'), config: SourceConfigByType.rclone }),
]);
export type Source = z.infer<typeof SourceSchema>;

export const LibrarySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sourceId: z.string().min(1),
  pathWithinSource: z.string(),
  libraryType: z.enum(['movie', 'tv', 'other']),
});
export type Library = z.infer<typeof LibrarySchema>;

export const ConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    sources: z.array(SourceSchema),
    libraries: z.array(LibrarySchema),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set(cfg.sources.map((s) => s.id));
    cfg.libraries.forEach((lib, i) => {
      if (!ids.has(lib.sourceId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['libraries', i, 'sourceId'],
          message: `sourceId "${lib.sourceId}" not found in sources`,
        });
      }
    });
  });
export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = {
  schemaVersion: 1,
  sources: [],
  libraries: [],
};
