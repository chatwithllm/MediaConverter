import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/mount.js', () => ({
  probeSmb: vi.fn(),
  probeNfs: vi.fn(),
}));

import { SmbDriver } from '../../src/drivers/smb.js';
import { probeSmb } from '../../src/lib/mount.js';

beforeEach(() => vi.clearAllMocks());

describe('SmbDriver', () => {
  it('returns ok=true when probeSmb succeeds', async () => {
    (probeSmb as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const r = await SmbDriver.validate({ host: 'h', share: 's', username: 'u', password: 'p' });
    expect(r.ok).toBe(true);
  });
  it('passes through probe errors', async () => {
    (probeSmb as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: 'no route' });
    const r = await SmbDriver.validate({ host: 'h', share: 's', username: 'u', password: 'p' });
    expect(r).toEqual({ ok: false, error: 'no route' });
  });
});
