export interface TdarrJob {
  _id: string;
  file: string;
  title?: string;
  status: 'queued' | 'processing' | 'success' | 'error' | 'cancelled' | string;
  workerId?: string;
  percentage?: number;
  ETA?: number;
  origLibraryFile?: { file: string };
}

export interface TdarrStatus {
  nodes: Array<{ _id: string; nodeName: string }>;
  queue: TdarrJob[];
  workers: TdarrJob[];
}

export class TdarrClient {
  constructor(
    private url: string,
    private apiKey?: string,
  ) {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
    const res = await fetch(`${this.url.replace(/\/$/, '')}${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`Tdarr ${path} ${res.status}`);
    return (await res.json()) as T;
  }

  async getStatus(): Promise<TdarrStatus> {
    return await this.req<TdarrStatus>('/api/v2/status');
  }

  async getHistory(sinceTs: number): Promise<TdarrJob[]> {
    return await this.req<TdarrJob[]>('/api/v2/cruddb', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          collection: 'JobReportTable',
          mode: 'getAll',
          docs: { createdAt: { $gt: sinceTs } },
        },
      }),
    });
  }
}
