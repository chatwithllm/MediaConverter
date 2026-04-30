import type { SourceType } from '@tpd/shared';

export interface ValidateResult { ok: boolean; error?: string; details?: Record<string, unknown>; }
export interface ListEntry { name: string; isDirectory: boolean; }

export interface SourceDriver<TConfig> {
  validate(config: TConfig): Promise<ValidateResult>;
  list?(config: TConfig, subPath: string): Promise<ListEntry[]>;
}

import { LocalDriver } from './local.js';
import { SmbDriver } from './smb.js';
import { NfsDriver } from './nfs.js';
import { TrueNasDriver } from './truenas.js';

export const driverRegistry: Record<SourceType, SourceDriver<unknown>> = {
  local: LocalDriver as SourceDriver<unknown>,
  smb: SmbDriver as SourceDriver<unknown>,
  nfs: NfsDriver as SourceDriver<unknown>,
  truenas: TrueNasDriver as SourceDriver<unknown>,
  rclone: {
    async validate() { return { ok: false, error: 'rclone driver deferred' }; },
  } as SourceDriver<unknown>,
};
