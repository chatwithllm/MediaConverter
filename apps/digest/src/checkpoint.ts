import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

interface Checkpoint { lastRunTs: number; }

export class CheckpointStore {
  constructor(private path: string) {}

  async load(): Promise<number> {
    try {
      const raw = await readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw) as Checkpoint;
      return Number(parsed.lastRunTs) || 0;
    } catch {
      return 0;
    }
  }

  async save(lastRunTs: number): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify({ lastRunTs }), 'utf8');
  }
}
