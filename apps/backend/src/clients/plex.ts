export interface PlexLibrarySection {
  key: string;
  title: string;
  type: 'movie' | 'show' | string;
}

export interface PlexRecentItem {
  ratingKey: string;
  title: string;
  addedAt: number;
}

export class PlexClient {
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async req<T>(path: string): Promise<T> {
    const res = await fetch(`${this.url.replace(/\/$/, '')}${path}`, {
      headers: {
        Accept: 'application/json',
        'X-Plex-Token': this.token,
      },
    });
    if (!res.ok) throw new Error(`Plex ${path} ${res.status}`);
    return (await res.json()) as T;
  }

  async getIdentity() {
    return await this.req<{ MediaContainer: { machineIdentifier: string } }>('/identity');
  }

  async getSections() {
    type Resp = { MediaContainer: { Directory: PlexLibrarySection[] } };
    const r = await this.req<Resp>('/library/sections');
    return r.MediaContainer?.Directory ?? [];
  }

  async getRecentlyAdded(sectionKey: string) {
    type Resp = { MediaContainer: { Metadata?: PlexRecentItem[] } };
    const r = await this.req<Resp>(`/library/sections/${sectionKey}/recentlyAdded`);
    return r.MediaContainer?.Metadata ?? [];
  }
}
