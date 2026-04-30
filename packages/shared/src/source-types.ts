import { z } from 'zod';

export const SOURCE_TYPES = ['local', 'truenas', 'smb', 'nfs', 'rclone'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const LocalSourceConfig = z.object({
  path: z.string().min(1),
});

export const SmbSourceConfig = z.object({
  host: z.string().min(1),
  share: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  domain: z.string().optional(),
});

export const NfsSourceConfig = z.object({
  host: z.string().min(1),
  exportPath: z.string().min(1),
  version: z.enum(['3', '4']).default('4'),
});

export const TrueNasSourceConfig = z.object({
  host: z.string().min(1),
  share: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  ssh: z
    .object({
      user: z.string().min(1),
      port: z.number().int().positive().default(22),
    })
    .optional(),
});

export const RcloneSourceConfig = z.object({
  remote: z.string().min(1),
});

export const SourceConfigByType = {
  local: LocalSourceConfig,
  smb: SmbSourceConfig,
  nfs: NfsSourceConfig,
  truenas: TrueNasSourceConfig,
  rclone: RcloneSourceConfig,
} as const;
