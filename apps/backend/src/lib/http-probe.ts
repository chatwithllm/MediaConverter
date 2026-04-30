export async function httpProbe(opts: {
  url: string;
  method?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  expectStatusBelow?: number;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!opts.url) return { ok: false, error: 'url is empty' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 5000);
  try {
    const res = await fetch(opts.url, {
      method: opts.method ?? 'GET',
      headers: opts.headers,
      signal: ctl.signal,
    });
    const limit = opts.expectStatusBelow ?? 500;
    return { ok: res.status < limit, status: res.status };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}
