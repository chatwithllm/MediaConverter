import type { Config } from '@tpd/shared';

async function http<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => http<{ ok: boolean }>('GET', '/api/health'),
  getConfig: () => http<Config>('GET', '/api/config'),
  putConfig: (cfg: Config) => http<Config>('PUT', '/api/config', cfg),
  testSource: (type: string, config: unknown) =>
    http<{ ok: boolean; error?: string; details?: Record<string, unknown> }>(
      'POST',
      '/api/sources/test',
      { type, config },
    ),
  listSource: (type: string, config: unknown, subPath: string) =>
    http<Array<{ name: string; isDirectory: boolean }>>('POST', '/api/sources/list', {
      type,
      config,
      subPath,
    }),
  testService: (
    kind: 'plex' | 'tdarr' | 'smartkanban',
    body: Record<string, string>,
  ) =>
    http<{ ok: boolean; error?: string; status?: number }>(
      'POST',
      `/api/services/${kind}/test`,
      body,
    ),
};
