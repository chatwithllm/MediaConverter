import type { SourceDriver, ValidateResult } from './index.js';
import { probeSmb } from '../lib/mount.js';

export interface TrueNasConfig {
  host: string; share: string; username: string; password: string;
  ssh?: { user: string; port: number };
}

export const TrueNasDriver: SourceDriver<TrueNasConfig> = {
  async validate(c): Promise<ValidateResult> {
    const r = await probeSmb({
      host: c.host, share: c.share, username: c.username, password: c.password,
    });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, details: { sshConfigured: !!c.ssh } };
  },
};
