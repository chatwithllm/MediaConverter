import { stat, readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { SourceDriver, ListEntry } from './index.js';

export interface LocalConfig {
  path: string;
}

export const LocalDriver: SourceDriver<LocalConfig> = {
  async validate(config) {
    try {
      const s = await stat(config.path);
      if (!s.isDirectory()) {
        return { ok: false, error: 'path is not a directory' };
      }
      await access(config.path, constants.R_OK);
      return { ok: true, details: { mode: s.mode.toString(8) } };
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      const msg =
        err.code === 'ENOENT'
          ? `path does not exist: ${config.path}`
          : err.message ?? String(e);
      return { ok: false, error: msg };
    }
  },

  async list(config, subPath) {
    const root = resolve(config.path);
    const target = resolve(root, subPath);
    const rel = relative(root, target);
    if (rel.startsWith('..') || rel.startsWith('/')) {
      throw new Error(`outside source root: ${subPath}`);
    }
    const dirents = await readdir(target, { withFileTypes: true });
    const entries: ListEntry[] = dirents.map((d) => ({
      name: d.name,
      isDirectory: d.isDirectory(),
    }));
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return entries;
  },
};
