import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/mount.js', () => ({
  probeSmb: vi.fn(),
  probeNfs: vi.fn(),
}));

import { NfsDriver } from '../../src/drivers/nfs.js';
import { probeNfs } from '../../src/lib/mount.js';

beforeEach(() => vi.clearAllMocks());

describe('NfsDriver', () => {
  it('returns ok=true when probeNfs succeeds', async () => {
    (probeNfs as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const r = await NfsDriver.validate({ host: 'h', exportPath: '/p', version: '4' });
    expect(r.ok).toBe(true);
  });
  it('passes through probe errors', async () => {
    (probeNfs as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: 'timeout' });
    const r = await NfsDriver.validate({ host: 'h', exportPath: '/p', version: '4' });
    expect(r).toEqual({ ok: false, error: 'timeout' });
  });
});
