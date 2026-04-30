import type { SourceDriver, ValidateResult } from './index.js';
import { probeNfs } from '../lib/mount.js';

export interface NfsConfig {
  host: string; exportPath: string; version: '3' | '4';
}

export const NfsDriver: SourceDriver<NfsConfig> = {
  async validate(c): Promise<ValidateResult> {
    const r = await probeNfs(c);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
};
