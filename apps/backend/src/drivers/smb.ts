import type { SourceDriver, ValidateResult } from './index.js';
import { probeSmb } from '../lib/mount.js';

export interface SmbConfig {
  host: string; share: string; username: string; password: string; domain?: string;
}

export const SmbDriver: SourceDriver<SmbConfig> = {
  async validate(c): Promise<ValidateResult> {
    const r = await probeSmb(c);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
};
