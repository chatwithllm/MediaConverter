export class SmartKanbanClient {
  constructor(
    private url: string,
    private token: string,
  ) {}

  async postActivity(
    cardId: string,
    body: string,
  ): Promise<{ ok: boolean; status: number; error?: string }> {
    const probeUrl = `${this.url.replace(/\/$/, '')}/api/cards/${encodeURIComponent(cardId)}/activity`;
    try {
      const res = await fetch(probeUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ body, source: 'transcode-digest' }),
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, status: 0, error: (e as Error).message };
    }
  }
}
