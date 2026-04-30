import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDigest } from '../src/digest.js';
import { CheckpointStore } from '../src/checkpoint.js';
import type { Config } from '@tpd/shared';

function mkCfg(over: Partial<Config> = {}): Config {
  return {
    schemaVersion: 1,
    sources: [],
    libraries: [],
    plex: { url: '', token: '' },
    tdarr: { url: 'http://t', apiKey: '' },
    smartKanban: { url: 'http://sk', token: 'tok', digestCardId: 'card-1' },
    encodeTargets: {
      hevc4kBitrateMbps: 25,
      h2641080pBitrateMbps: 8,
      aacBitrateKbps: 192,
      tonemapAlgorithm: 'hable',
      enable4kHevcVariant: true,
      enable1080pSdrVariant: true,
    },
    onboardingComplete: true,
    ...over,
  } as Config;
}

function mkDeps() {
  const dir = mkdtempSync(join(tmpdir(), 'tpd-d-'));
  const checkpoint = new CheckpointStore(join(dir, 'cp.json'));
  const tdarrGet = vi.fn();
  const skPost = vi.fn();
  return {
    checkpoint,
    tdarrGet,
    skPost,
    deps: (cfg: Config) =>
      ({
        cfg,
        checkpoint,
        tdarrFactory: () => ({ getHistory: tdarrGet }),
        smartKanbanFactory: () => ({ postActivity: skPost }),
        now: () => 1000,
      }) as Parameters<typeof runDigest>[0],
  };
}

describe('runDigest', () => {
  it('skips when tdarr.url is empty', async () => {
    const r = await runDigest({
      cfg: mkCfg({ tdarr: { url: '', apiKey: '' } }),
      checkpoint: new CheckpointStore('/tmp/none.json'),
    });
    expect(r.posted).toBe(false);
    expect(r.reason).toMatch(/tdarr.url/);
  });

  it('skips when smartkanban not fully configured', async () => {
    const r = await runDigest({
      cfg: mkCfg({ smartKanban: { url: '', token: '', digestCardId: '' } }),
      checkpoint: new CheckpointStore('/tmp/none.json'),
    });
    expect(r.posted).toBe(false);
    expect(r.reason).toMatch(/smartKanban/);
  });

  it('does not post when no jobs in history', async () => {
    const m = mkDeps();
    m.tdarrGet.mockResolvedValue([]);
    m.skPost.mockResolvedValue({ ok: true, status: 200 });
    const cfg = mkCfg();
    const r = await runDigest(m.deps(cfg));
    expect(r.posted).toBe(false);
    expect(m.skPost).not.toHaveBeenCalled();
    expect(await m.checkpoint.load()).toBe(1000);
  });

  it('posts a digest when jobs exist', async () => {
    const m = mkDeps();
    m.tdarrGet.mockResolvedValue([
      { _id: '1', file: '/m/dune.mkv', title: 'Dune', status: 'success' },
      { _id: '2', file: '/m/tenet.mkv', title: 'Tenet', status: 'success' },
      { _id: '3', file: '/m/x.mkv', title: 'X', status: 'error' },
    ]);
    m.skPost.mockResolvedValue({ ok: true, status: 200 });
    const cfg = mkCfg();
    const r = await runDigest(m.deps(cfg));
    expect(r.posted).toBe(true);
    expect(r.done).toBe(2);
    expect(r.failed).toBe(1);
    const callArgs = m.skPost.mock.calls[0]!;
    expect(callArgs[0]).toBe('card-1');
    expect(callArgs[1]).toMatch(/2 done/);
    expect(callArgs[1]).toMatch(/Dune/);
    expect(await m.checkpoint.load()).toBe(1000);
  });

  it('does not advance checkpoint if smartkanban POST fails', async () => {
    const m = mkDeps();
    m.tdarrGet.mockResolvedValue([
      { _id: '1', file: '/m/dune.mkv', title: 'Dune', status: 'success' },
    ]);
    m.skPost.mockResolvedValue({ ok: false, status: 502, error: 'Bad Gateway' });
    const cfg = mkCfg();
    const r = await runDigest(m.deps(cfg));
    expect(r.posted).toBe(false);
    expect(r.reason).toMatch(/502/);
    expect(await m.checkpoint.load()).toBe(0);
  });
});
