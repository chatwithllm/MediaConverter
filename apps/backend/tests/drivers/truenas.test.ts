import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/mount.js', () => ({ probeSmb: vi.fn() }));

import { TrueNasDriver } from '../../src/drivers/truenas.js';
import { probeSmb } from '../../src/lib/mount.js';

beforeEach(() => vi.clearAllMocks());

describe('TrueNasDriver', () => {
  it('reports sshConfigured=true when ssh block present', async () => {
    (probeSmb as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const r = await TrueNasDriver.validate({
      host: 'h', share: 's', username: 'u', password: 'p',
      ssh: { user: 'admin', port: 22 },
    });
    expect(r.ok).toBe(true);
    expect(r.details?.sshConfigured).toBe(true);
  });
  it('reports sshConfigured=false when omitted', async () => {
    (probeSmb as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const r = await TrueNasDriver.validate({ host: 'h', share: 's', username: 'u', password: 'p' });
    expect(r.details?.sshConfigured).toBe(false);
  });
});
