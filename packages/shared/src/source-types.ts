import { z } from 'zod';

export const SOURCE_TYPES = ['local', 'truenas', 'smb', 'nfs', 'rclone'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const LocalSourceConfig = z.object({
  path: z.string().min(1),
});

export const PlaceholderConfig = z.record(z.string(), z.unknown());

export const SourceConfigByType = {
  local: LocalSourceConfig,
  truenas: PlaceholderConfig,
  smb: PlaceholderConfig,
  nfs: PlaceholderConfig,
  rclone: PlaceholderConfig,
} as const;
