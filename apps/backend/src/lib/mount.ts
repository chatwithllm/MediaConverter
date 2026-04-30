import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface RunResult { code: number; stdout: string; stderr: string; }

function run(cmd: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
    p.on('error', (e) => resolve({ code: -1, stdout: '', stderr: e.message }));
  });
}

export async function probeSmb(opts: {
  host: string; share: string; username: string; password: string; domain?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'tpd-smb-probe-'));
  const userPart = opts.domain ? `${opts.domain};${opts.username}` : opts.username;
  const url = `//${encodeURIComponent(userPart)}:${encodeURIComponent(opts.password)}@${opts.host}/${encodeURIComponent(opts.share)}`;
  const mounted = await run('mount_smbfs', [url, dir]);
  if (mounted.code !== 0) {
    await rm(dir, { recursive: true, force: true });
    return { ok: false, error: mounted.stderr.trim() || `mount_smbfs exited ${mounted.code}` };
  }
  await run('umount', [dir]);
  await rm(dir, { recursive: true, force: true });
  return { ok: true };
}

export async function probeNfs(opts: {
  host: string; exportPath: string; version: '3' | '4';
}): Promise<{ ok: boolean; error?: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'tpd-nfs-probe-'));
  const versionFlag = `vers=${opts.version}`;
  const mounted = await run('mount_nfs', [
    '-o', `${versionFlag},soft,timeo=30,retrans=2`,
    `${opts.host}:${opts.exportPath}`, dir,
  ]);
  if (mounted.code !== 0) {
    await rm(dir, { recursive: true, force: true });
    return { ok: false, error: mounted.stderr.trim() || `mount_nfs exited ${mounted.code}` };
  }
  await run('umount', [dir]);
  await rm(dir, { recursive: true, force: true });
  return { ok: true };
}
