import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Config, ConfigSchema, DEFAULT_CONFIG } from '@tpd/shared';
import { InvalidConfigError } from './lib/errors.js';

export class ConfigStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<Config> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULT_CONFIG;
      throw e;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new InvalidConfigError(`invalid config json: ${(e as Error).message}`);
    }
    const result = ConfigSchema.safeParse(parsed);
    if (!result.success) {
      throw new InvalidConfigError(`invalid config schema: ${result.error.message}`);
    }
    return result.data;
  }

  async save(cfg: Config): Promise<void> {
    const result = ConfigSchema.safeParse(cfg);
    if (!result.success) {
      throw new InvalidConfigError(`invalid config schema: ${result.error.message}`);
    }
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(result.data, null, 2), 'utf8');
    await rename(tmp, this.filePath);
  }
}
