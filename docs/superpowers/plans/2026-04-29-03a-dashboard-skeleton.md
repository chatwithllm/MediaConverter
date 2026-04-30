# Phase 3a — Dashboard Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `TranscodePipelineDash` repo with a Fastify backend, React+Vite frontend, typed config schema, persistent JSON config store, Settings API, a working `local` source driver, and a connection-tester end-to-end. After this phase the user can launch the app, walk through a minimal onboarding wizard for one local source, save it, and see it persist across restarts.

**Architecture:** Monorepo (npm workspaces) with three packages: `apps/backend` (Fastify + TypeScript), `apps/frontend` (React + TypeScript + Vite + Tailwind), `packages/shared` (zod schemas + types shared across backend/frontend). Config persists to a single JSON file at `apps/backend/data/config.json`. Source drivers implement a small interface (`validate`, `list`); `local` driver lands here; other types (`truenas`, `smb`, `nfs`, `rclone`) follow in 3b. No real Tdarr/Plex integration in this phase — mock mode covers that until 3c.

**Tech Stack:** Node.js 22 LTS, TypeScript 5.6+, Fastify 4, zod, React 18, Vite 5, TailwindCSS, Vitest (test runner), ESLint, Prettier.

**Source spec:** [docs/superpowers/specs/2026-04-29-truenas-plex-transcode-pipeline-design.md](../specs/2026-04-29-truenas-plex-transcode-pipeline-design.md)

**Parent plan:** [2026-04-29-truenas-plex-transcode-pipeline.md](./2026-04-29-truenas-plex-transcode-pipeline.md)

**Repo location:** `/Users/npalakurla/WorkingFolder/TranscodePipelineDash` (new git repo, separate from the docs/spec repo).

---

## File Structure (created in this phase)

```
TranscodePipelineDash/
  package.json                          # root, npm workspaces
  tsconfig.base.json                    # shared TS settings
  .gitignore
  .editorconfig
  .nvmrc                                # node 22
  .prettierrc.json
  .eslintrc.cjs
  README.md                             # quickstart + dev commands
  packages/
    shared/
      package.json
      tsconfig.json
      src/
        index.ts                        # re-exports
        config-schema.ts                # zod schemas: Source, Library, Config
        source-types.ts                 # SourceType union, SourceDriver interface
      tests/
        config-schema.test.ts
  apps/
    backend/
      package.json
      tsconfig.json
      src/
        index.ts                        # Fastify bootstrap
        env.ts                          # env var loader
        config-store.ts                 # JSON file read/write, encryption stub
        routes/
          health.ts                     # GET /api/health
          config.ts                     # GET /api/config, PUT /api/config
          sources.ts                    # POST /api/sources/test, POST /api/sources/list
        drivers/
          index.ts                      # SourceDriver registry
          local.ts                      # local FS driver
        lib/
          errors.ts                     # typed app errors
          logger.ts                     # pino wrapper
      tests/
        config-store.test.ts
        routes/
          config.test.ts
          sources.test.ts
        drivers/
          local.test.ts
      data/                             # gitignored; runtime config lives here
        .gitkeep
    frontend/
      package.json
      tsconfig.json
      vite.config.ts
      tailwind.config.ts
      postcss.config.cjs
      index.html
      src/
        main.tsx
        App.tsx
        api/
          client.ts                     # typed fetch wrappers
        components/
          Settings/
            SourcesList.tsx
            SourceRow.tsx
            ConnectionBadge.tsx
          PathPicker/
            PathPickerLocal.tsx
        pages/
          SettingsPage.tsx
        styles/
          theme.css                     # SmartKanban-style tokens (palette, type)
          tailwind.css
      tests/
        components/
          ConnectionBadge.test.tsx
```

Files outside this list are **not** part of this phase. The Flow view, Kanban view, Tdarr/Plex clients, mock-mode harness, and other source drivers come in 3b–3e.

---

## Task 1: Repo Bootstrap

**Files:**
- Create: `TranscodePipelineDash/package.json`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`, `.prettierrc.json`, `.eslintrc.cjs`, `.editorconfig`, `README.md`
- Create: `TranscodePipelineDash/.git/` (via `git init`)

- [ ] **Step 1: Create the repo directory**

```bash
mkdir -p /Users/npalakurla/WorkingFolder/TranscodePipelineDash
cd /Users/npalakurla/WorkingFolder/TranscodePipelineDash
git init -q
```

Verify:
```bash
test -d .git && echo OK
```
Expected: `OK`

- [ ] **Step 2: Pin Node version**

```bash
echo 22 > .nvmrc
```

- [ ] **Step 3: Write the root `package.json` with workspaces**

`TranscodePipelineDash/package.json`:
```json
{
  "name": "transcode-pipeline-dash",
  "version": "0.0.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write .",
    "dev:backend": "npm run dev -w @tpd/backend",
    "dev:frontend": "npm run dev -w @tpd/frontend"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0",
    "typescript": "^5.6.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0"
  }
}
```

- [ ] **Step 4: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
dist/
.DS_Store
.env
.env.local
*.log
apps/backend/data/config.json
apps/backend/data/*.key
coverage/
```

- [ ] **Step 6: Write `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 7: Write `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  ignorePatterns: ['dist/', 'node_modules/'],
};
```

- [ ] **Step 8: Write `.editorconfig`**

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

- [ ] **Step 9: Write `README.md`**

```markdown
# TranscodePipelineDash

Live dashboard for the TrueNAS → Plex transcode pipeline.

## Dev

Requires Node 22 and npm.

```sh
nvm use
npm install
npm run dev:backend   # in one terminal
npm run dev:frontend  # in another
```

Backend listens on `http://localhost:3100` by default.
Frontend dev server runs on `http://localhost:5173` and proxies `/api` to the backend.
```

- [ ] **Step 10: Install root devDependencies**

```bash
npm install
```

Expected: `node_modules/` populated; no errors.

- [ ] **Step 11: Initial commit**

```bash
git add .
git commit -m "chore: bootstrap monorepo skeleton"
```

Verify:
```bash
git log --oneline -1
```
Expected: one commit visible.

---

## Task 2: Shared Package — Config Schemas

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`, `packages/shared/src/config-schema.ts`, `packages/shared/src/source-types.ts`
- Test: `packages/shared/tests/config-schema.test.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@tpd/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write the failing test for the source-types schema**

`packages/shared/tests/config-schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ConfigSchema, SourceSchema, LibrarySchema } from '../src/config-schema.js';

describe('SourceSchema', () => {
  it('accepts a local source', () => {
    const parsed = SourceSchema.parse({
      id: 'src-local-1',
      label: 'Mac internal disk',
      type: 'local',
      config: { path: '/Users/test/Movies' },
    });
    expect(parsed.type).toBe('local');
  });

  it('rejects a local source without a path', () => {
    expect(() =>
      SourceSchema.parse({
        id: 'src-local-1',
        label: 'Mac internal disk',
        type: 'local',
        config: {},
      }),
    ).toThrow();
  });

  it('rejects an unknown source type', () => {
    expect(() =>
      SourceSchema.parse({
        id: 'src-x',
        label: 'x',
        type: 'webdav',
        config: {},
      }),
    ).toThrow();
  });
});

describe('LibrarySchema', () => {
  it('accepts a library row referencing a source by id', () => {
    const parsed = LibrarySchema.parse({
      id: 'lib-1',
      label: 'Movies',
      sourceId: 'src-local-1',
      pathWithinSource: 'movies',
      libraryType: 'movie',
    });
    expect(parsed.libraryType).toBe('movie');
  });

  it('rejects a library row with no sourceId', () => {
    expect(() =>
      LibrarySchema.parse({
        id: 'lib-1',
        label: 'Movies',
        pathWithinSource: 'movies',
        libraryType: 'movie',
      }),
    ).toThrow();
  });
});

describe('ConfigSchema', () => {
  it('accepts a minimal valid config', () => {
    const config = ConfigSchema.parse({
      schemaVersion: 1,
      sources: [
        {
          id: 'src-local-1',
          label: 'Local disk',
          type: 'local',
          config: { path: '/tmp/media' },
        },
      ],
      libraries: [
        {
          id: 'lib-1',
          label: 'Movies',
          sourceId: 'src-local-1',
          pathWithinSource: 'movies',
          libraryType: 'movie',
        },
      ],
    });
    expect(config.schemaVersion).toBe(1);
    expect(config.sources).toHaveLength(1);
    expect(config.libraries).toHaveLength(1);
  });

  it('rejects a library that points to a non-existent source id', () => {
    expect(() =>
      ConfigSchema.parse({
        schemaVersion: 1,
        sources: [],
        libraries: [
          {
            id: 'lib-1',
            label: 'Movies',
            sourceId: 'src-missing',
            pathWithinSource: 'movies',
            libraryType: 'movie',
          },
        ],
      }),
    ).toThrow(/sourceId.*not found/);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd packages/shared
npm install
npm test 2>&1 | tail -20
```
Expected: tests fail with module-not-found or undefined-export errors (the schema files do not yet exist).

- [ ] **Step 5: Implement `packages/shared/src/source-types.ts`**

```ts
import { z } from 'zod';

export const SOURCE_TYPES = ['local', 'truenas', 'smb', 'nfs', 'rclone'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const LocalSourceConfig = z.object({
  path: z.string().min(1),
});

export const PlaceholderConfig = z.record(z.string(), z.unknown());

export const SourceConfigByType = {
  local: LocalSourceConfig,
  truenas: PlaceholderConfig,
  smb: PlaceholderConfig,
  nfs: PlaceholderConfig,
  rclone: PlaceholderConfig,
} as const;
```

- [ ] **Step 6: Implement `packages/shared/src/config-schema.ts`**

```ts
import { z } from 'zod';
import { SOURCE_TYPES, SourceConfigByType } from './source-types.js';

const baseSource = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const SourceSchema = z.discriminatedUnion('type', [
  baseSource.extend({ type: z.literal('local'), config: SourceConfigByType.local }),
  baseSource.extend({ type: z.literal('truenas'), config: SourceConfigByType.truenas }),
  baseSource.extend({ type: z.literal('smb'), config: SourceConfigByType.smb }),
  baseSource.extend({ type: z.literal('nfs'), config: SourceConfigByType.nfs }),
  baseSource.extend({ type: z.literal('rclone'), config: SourceConfigByType.rclone }),
]);
export type Source = z.infer<typeof SourceSchema>;

export const LibrarySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sourceId: z.string().min(1),
  pathWithinSource: z.string(),
  libraryType: z.enum(['movie', 'tv', 'other']),
});
export type Library = z.infer<typeof LibrarySchema>;

export const ConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    sources: z.array(SourceSchema),
    libraries: z.array(LibrarySchema),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set(cfg.sources.map((s) => s.id));
    cfg.libraries.forEach((lib, i) => {
      if (!ids.has(lib.sourceId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['libraries', i, 'sourceId'],
          message: `sourceId "${lib.sourceId}" not found in sources`,
        });
      }
    });
  });
export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = {
  schemaVersion: 1,
  sources: [],
  libraries: [],
};
```

- [ ] **Step 7: Implement `packages/shared/src/index.ts`**

```ts
export * from './config-schema.js';
export * from './source-types.js';
```

- [ ] **Step 8: Run tests, verify pass**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
cd ../..
git add packages/shared
git commit -m "feat(shared): add Source, Library, Config zod schemas"
```

---

## Task 3: Backend — Config Store

**Files:**
- Create: `apps/backend/package.json`, `apps/backend/tsconfig.json`
- Create: `apps/backend/src/config-store.ts`, `apps/backend/src/lib/errors.ts`, `apps/backend/src/lib/logger.ts`
- Test: `apps/backend/tests/config-store.test.ts`

- [ ] **Step 1: Create `apps/backend/package.json`**

```json
{
  "name": "@tpd/backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tpd/shared": "*",
    "fastify": "^4.28.0",
    "@fastify/cors": "^9.0.0",
    "pino": "^9.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0",
    "@types/node": "^22.5.0"
  }
}
```

- [ ] **Step 2: Create `apps/backend/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@tpd/shared": ["../../packages/shared/src/index.ts"]
    }
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Install backend deps**

```bash
cd apps/backend
mkdir -p data
touch data/.gitkeep
npm install
```

- [ ] **Step 4: Write the failing test for `config-store`**

`apps/backend/tests/config-store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigStore } from '../src/config-store.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tpd-cfg-'));
});

describe('ConfigStore', () => {
  it('returns DEFAULT_CONFIG when no file exists', async () => {
    const store = new ConfigStore(join(dir, 'config.json'));
    const cfg = await store.load();
    expect(cfg.schemaVersion).toBe(1);
    expect(cfg.sources).toEqual([]);
    expect(cfg.libraries).toEqual([]);
  });

  it('persists and reloads a config round-trip', async () => {
    const file = join(dir, 'config.json');
    const a = new ConfigStore(file);
    await a.save({
      schemaVersion: 1,
      sources: [
        { id: 'src-1', label: 'Local', type: 'local', config: { path: '/tmp/media' } },
      ],
      libraries: [],
    });
    const b = new ConfigStore(file);
    const reloaded = await b.load();
    expect(reloaded.sources).toHaveLength(1);
    expect(reloaded.sources[0].id).toBe('src-1');
  });

  it('throws on a corrupt config file', async () => {
    const file = join(dir, 'config.json');
    const fs = await import('node:fs/promises');
    await fs.writeFile(file, '{ not valid json', 'utf8');
    const store = new ConfigStore(file);
    await expect(store.load()).rejects.toThrow(/invalid config/i);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
npm test 2>&1 | tail -10
```
Expected: failure (`ConfigStore` not found).

- [ ] **Step 6: Implement `apps/backend/src/lib/errors.ts`**

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class InvalidConfigError extends AppError {
  constructor(message: string) {
    super(message, 'INVALID_CONFIG', 400);
    this.name = 'InvalidConfigError';
  }
}
```

- [ ] **Step 7: Implement `apps/backend/src/lib/logger.ts`**

```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss.l' } },
});
```

- [ ] **Step 8: Implement `apps/backend/src/config-store.ts`**

```ts
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
```

- [ ] **Step 9: Install pino-pretty for dev logger**

```bash
npm install --save-dev pino-pretty
```

- [ ] **Step 10: Run tests, verify pass**

```bash
npm test
```
Expected: all 3 `ConfigStore` tests pass plus the shared tests when run from the root.

- [ ] **Step 11: Commit**

```bash
cd ../..
git add apps/backend
git commit -m "feat(backend): add ConfigStore with atomic JSON persistence and zod validation"
```

---

## Task 4: Backend — Local Source Driver

**Files:**
- Create: `apps/backend/src/drivers/index.ts`, `apps/backend/src/drivers/local.ts`
- Test: `apps/backend/tests/drivers/local.test.ts`

- [ ] **Step 1: Write the failing test for the `local` driver**

`apps/backend/tests/drivers/local.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDriver } from '../../src/drivers/local.js';

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'tpd-local-'));
  mkdirSync(join(root, 'movies'));
  mkdirSync(join(root, 'tv'));
  writeFileSync(join(root, 'movies', 'README.txt'), 'hi');
});

describe('LocalDriver', () => {
  it('validates an existing readable directory', async () => {
    const r = await LocalDriver.validate({ path: root });
    expect(r.ok).toBe(true);
  });

  it('returns ok=false for a non-existent path', async () => {
    const r = await LocalDriver.validate({ path: join(root, 'does-not-exist') });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not exist|enoent/i);
  });

  it('lists immediate children of a path', async () => {
    const entries = await LocalDriver.list({ path: root }, '');
    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(['movies', 'tv']);
    expect(entries.find((e) => e.name === 'movies')?.isDirectory).toBe(true);
  });

  it('rejects path traversal outside the configured root', async () => {
    await expect(LocalDriver.list({ path: root }, '../../../etc')).rejects.toThrow(
      /outside source root/i,
    );
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd apps/backend
npm test 2>&1 | tail -10
```
Expected: failure.

- [ ] **Step 3: Implement `apps/backend/src/drivers/index.ts`**

```ts
export interface ValidateResult {
  ok: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

export interface ListEntry {
  name: string;
  isDirectory: boolean;
}

export interface SourceDriver<TConfig> {
  validate(config: TConfig): Promise<ValidateResult>;
  list(config: TConfig, subPath: string): Promise<ListEntry[]>;
}
```

- [ ] **Step 4: Implement `apps/backend/src/drivers/local.ts`**

```ts
import { stat, readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { SourceDriver, ValidateResult, ListEntry } from './index.js';

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
```

- [ ] **Step 5: Run tests, verify pass**

```bash
npm test
```
Expected: all `LocalDriver` tests pass.

- [ ] **Step 6: Commit**

```bash
cd ../..
git add apps/backend
git commit -m "feat(backend): add LocalDriver with validate, list, and traversal protection"
```

---

## Task 5: Backend — HTTP Routes (`/api/health`, `/api/config`, `/api/sources/test`, `/api/sources/list`)

**Files:**
- Create: `apps/backend/src/index.ts`, `apps/backend/src/env.ts`, `apps/backend/src/routes/health.ts`, `apps/backend/src/routes/config.ts`, `apps/backend/src/routes/sources.ts`
- Test: `apps/backend/tests/routes/config.test.ts`, `apps/backend/tests/routes/sources.test.ts`

- [ ] **Step 1: Write the failing tests**

`apps/backend/tests/routes/config.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../../src/index.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tpd-routes-'));
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });
});

describe('GET /api/config', () => {
  it('returns DEFAULT_CONFIG when no file exists', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ schemaVersion: 1, sources: [], libraries: [] });
    await app.close();
  });
});

describe('PUT /api/config', () => {
  it('saves and round-trips a valid config', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const body = {
      schemaVersion: 1,
      sources: [
        { id: 'src-1', label: 'Local', type: 'local', config: { path: '/tmp/media' } },
      ],
      libraries: [],
    };
    const put = await app.inject({ method: 'PUT', url: '/api/config', payload: body });
    expect(put.statusCode).toBe(200);
    const get = await app.inject({ method: 'GET', url: '/api/config' });
    expect(get.json()).toEqual(body);
    await app.close();
  });

  it('rejects an invalid config with 400', async () => {
    const app = await buildApp({ configFile: join(dir, 'config.json') });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config',
      payload: { schemaVersion: 1, sources: 'not an array', libraries: [] },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

`apps/backend/tests/routes/sources.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../../src/index.js';

let appRoot: string;
let mediaRoot: string;
beforeAll(() => {
  appRoot = mkdtempSync(join(tmpdir(), 'tpd-app-'));
  mediaRoot = mkdtempSync(join(tmpdir(), 'tpd-media-'));
  mkdirSync(join(mediaRoot, 'movies'));
});

describe('POST /api/sources/test', () => {
  it('returns ok=true for a valid local path', async () => {
    const app = await buildApp({ configFile: join(appRoot, 'config.json') });
    const res = await app.inject({
      method: 'POST',
      url: '/api/sources/test',
      payload: { type: 'local', config: { path: mediaRoot } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });

  it('returns ok=false for a missing path', async () => {
    const app = await buildApp({ configFile: join(appRoot, 'config.json') });
    const res = await app.inject({
      method: 'POST',
      url: '/api/sources/test',
      payload: { type: 'local', config: { path: '/no/such/path' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: false });
    await app.close();
  });
});

describe('POST /api/sources/list', () => {
  it('lists immediate children', async () => {
    const app = await buildApp({ configFile: join(appRoot, 'config.json') });
    const res = await app.inject({
      method: 'POST',
      url: '/api/sources/list',
      payload: { type: 'local', config: { path: mediaRoot }, subPath: '' },
    });
    expect(res.statusCode).toBe(200);
    const entries = res.json() as Array<{ name: string; isDirectory: boolean }>;
    expect(entries.find((e) => e.name === 'movies')?.isDirectory).toBe(true);
    await app.close();
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

```bash
cd apps/backend
npm test 2>&1 | tail -10
```
Expected: failure (`buildApp` not found).

- [ ] **Step 3: Implement `apps/backend/src/env.ts`**

```ts
export interface AppEnv {
  port: number;
  configFile: string;
}

export function readEnv(): AppEnv {
  return {
    port: Number(process.env.PORT ?? 3100),
    configFile: process.env.CONFIG_FILE ?? './data/config.json',
  };
}
```

- [ ] **Step 4: Implement `apps/backend/src/routes/health.ts`**

```ts
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({ ok: true }));
}
```

- [ ] **Step 5: Implement `apps/backend/src/routes/config.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { ConfigSchema } from '@tpd/shared';
import type { ConfigStore } from '../config-store.js';
import { InvalidConfigError } from '../lib/errors.js';

export function configRoutes(store: ConfigStore) {
  return async function (app: FastifyInstance) {
    app.get('/api/config', async () => store.load());

    app.put('/api/config', async (req, reply) => {
      const parsed = ConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid config', issues: parsed.error.issues });
      }
      try {
        await store.save(parsed.data);
        return parsed.data;
      } catch (e) {
        if (e instanceof InvalidConfigError) {
          return reply.code(400).send({ error: e.message });
        }
        throw e;
      }
    });
  };
}
```

- [ ] **Step 6: Implement `apps/backend/src/routes/sources.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SourceConfigByType, SOURCE_TYPES } from '@tpd/shared';
import { LocalDriver } from '../drivers/local.js';

const TestBody = z.object({
  type: z.enum(SOURCE_TYPES),
  config: z.unknown(),
});

const ListBody = TestBody.extend({
  subPath: z.string(),
});

export async function sourceRoutes(app: FastifyInstance) {
  app.post('/api/sources/test', async (req, reply) => {
    const parsed = TestBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { type, config } = parsed.data;
    if (type !== 'local') {
      return { ok: false, error: `driver "${type}" not yet implemented in 3a` };
    }
    const lc = SourceConfigByType.local.safeParse(config);
    if (!lc.success) return { ok: false, error: lc.error.message };
    return await LocalDriver.validate(lc.data);
  });

  app.post('/api/sources/list', async (req, reply) => {
    const parsed = ListBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { type, config, subPath } = parsed.data;
    if (type !== 'local') {
      return reply.code(400).send({ error: `driver "${type}" not yet implemented in 3a` });
    }
    const lc = SourceConfigByType.local.safeParse(config);
    if (!lc.success) return reply.code(400).send({ error: lc.error.message });
    return await LocalDriver.list(lc.data, subPath);
  });
}
```

- [ ] **Step 7: Implement `apps/backend/src/index.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ConfigStore } from './config-store.js';
import { healthRoutes } from './routes/health.js';
import { configRoutes } from './routes/config.js';
import { sourceRoutes } from './routes/sources.js';
import { logger } from './lib/logger.js';
import { readEnv } from './env.js';

export interface BuildOptions {
  configFile: string;
}

export async function buildApp(opts: BuildOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  await app.register(cors, { origin: true });
  const store = new ConfigStore(opts.configFile);
  await app.register(healthRoutes);
  await app.register(configRoutes(store));
  await app.register(sourceRoutes);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = readEnv();
  buildApp({ configFile: env.configFile })
    .then((app) => app.listen({ port: env.port, host: '0.0.0.0' }))
    .then((addr) => logger.info(`listening on ${addr}`))
    .catch((err) => {
      logger.error(err);
      process.exit(1);
    });
}
```

- [ ] **Step 8: Run tests, verify pass**

```bash
npm test
```
Expected: all backend tests pass.

- [ ] **Step 9: Smoke-start the dev server**

```bash
npm run dev &
DEV_PID=$!
sleep 2
curl -s http://localhost:3100/api/health
echo
curl -s http://localhost:3100/api/config
echo
kill $DEV_PID
```
Expected:
```
{"ok":true}
{"schemaVersion":1,"sources":[],"libraries":[]}
```

- [ ] **Step 10: Commit**

```bash
cd ../..
git add apps/backend
git commit -m "feat(backend): expose /api/health, /api/config, /api/sources/{test,list}"
```

---

## Task 6: Frontend — Bootstrap (Vite + React + Tailwind)

**Files:**
- Create: `apps/frontend/package.json`, `apps/frontend/tsconfig.json`, `apps/frontend/vite.config.ts`
- Create: `apps/frontend/index.html`, `apps/frontend/tailwind.config.ts`, `apps/frontend/postcss.config.cjs`
- Create: `apps/frontend/src/main.tsx`, `apps/frontend/src/App.tsx`
- Create: `apps/frontend/src/styles/tailwind.css`, `apps/frontend/src/styles/theme.css`

- [ ] **Step 1: Create `apps/frontend/package.json`**

```json
{
  "name": "@tpd/frontend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tpd/shared": "*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "happy-dom": "^15.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/frontend/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "Bundler",
    "paths": {
      "@tpd/shared": ["../../packages/shared/src/index.ts"]
    }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `apps/frontend/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3100',
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: [],
  },
});
```

- [ ] **Step 4: Create `apps/frontend/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f2f0eb',
        ink: '#1d1d1d',
        accent: {
          DEFAULT: '#006241',
          dim: '#1a8a5a',
          bright: '#3aa97a',
        },
        warn: '#c8541b',
        danger: '#a31518',
      },
      fontFamily: {
        sans: ['"SoDoSans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Create `apps/frontend/postcss.config.cjs`**

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 6: Create `apps/frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TranscodePipelineDash</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `apps/frontend/src/styles/tailwind.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Create `apps/frontend/src/styles/theme.css`**

```css
:root {
  --color-canvas: #f2f0eb;
  --color-ink: #1d1d1d;
  --color-accent: #006241;
  --color-accent-dim: #1a8a5a;
  --color-accent-bright: #3aa97a;
  --color-warn: #c8541b;
  --color-danger: #a31518;
}

body {
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: 'SoDoSans', system-ui, sans-serif;
  margin: 0;
}
```

- [ ] **Step 9: Create `apps/frontend/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles/tailwind.css';
import './styles/theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 10: Create `apps/frontend/src/App.tsx`**

```tsx
import { SettingsPage } from './pages/SettingsPage.js';

export default function App() {
  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-accent">TranscodePipelineDash</h1>
        <p className="text-sm opacity-70">Phase 3a — Settings only</p>
      </header>
      <main>
        <SettingsPage />
      </main>
    </div>
  );
}
```

- [ ] **Step 11: Install frontend deps**

```bash
cd apps/frontend
npm install
```

- [ ] **Step 12: Smoke-build the frontend**

```bash
npm run build
```
Expected: build completes; `dist/` produced.

- [ ] **Step 13: Commit**

```bash
cd ../..
git add apps/frontend
git commit -m "feat(frontend): bootstrap Vite + React + Tailwind shell with theme tokens"
```

---

## Task 7: Frontend — API Client + Settings Page (Sources List)

**Files:**
- Create: `apps/frontend/src/api/client.ts`
- Create: `apps/frontend/src/components/Settings/SourcesList.tsx`, `SourceRow.tsx`, `ConnectionBadge.tsx`
- Create: `apps/frontend/src/components/PathPicker/PathPickerLocal.tsx`
- Create: `apps/frontend/src/pages/SettingsPage.tsx`
- Test: `apps/frontend/tests/components/ConnectionBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/frontend/tests/components/ConnectionBadge.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionBadge } from '../../src/components/Settings/ConnectionBadge.js';

describe('ConnectionBadge', () => {
  it('renders idle state', () => {
    render(<ConnectionBadge state="idle" />);
    expect(screen.getByRole('status')).toHaveTextContent(/not tested/i);
  });

  it('renders ok state', () => {
    render(<ConnectionBadge state="ok" />);
    expect(screen.getByRole('status')).toHaveTextContent(/connected/i);
  });

  it('renders error state with message', () => {
    render(<ConnectionBadge state="error" message="path does not exist" />);
    expect(screen.getByRole('status')).toHaveTextContent(/path does not exist/i);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd apps/frontend
npm test 2>&1 | tail -10
```
Expected: failure.

- [ ] **Step 3: Implement `apps/frontend/src/api/client.ts`**

```ts
import type { Config } from '@tpd/shared';

async function http<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
};
```

- [ ] **Step 4: Implement `apps/frontend/src/components/Settings/ConnectionBadge.tsx`**

```tsx
export type ConnectionState = 'idle' | 'testing' | 'ok' | 'error';

export function ConnectionBadge({
  state,
  message,
}: {
  state: ConnectionState;
  message?: string;
}) {
  const text =
    state === 'idle'
      ? 'Not tested'
      : state === 'testing'
        ? 'Testing…'
        : state === 'ok'
          ? 'Connected'
          : `Error: ${message ?? 'unknown'}`;
  const color =
    state === 'ok'
      ? 'text-accent-dim'
      : state === 'error'
        ? 'text-danger'
        : 'text-ink/60';
  return (
    <span role="status" className={`inline-block text-sm font-medium ${color}`}>
      {text}
    </span>
  );
}
```

- [ ] **Step 5: Implement `PathPickerLocal.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export function PathPickerLocal({
  basePath,
  onChange,
}: {
  basePath: string;
  onChange: (p: string) => void;
}) {
  const [subPath, setSubPath] = useState('');
  const [entries, setEntries] = useState<Array<{ name: string; isDirectory: boolean }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listSource('local', { path: basePath }, subPath)
      .then((rows) => {
        if (!cancelled) {
          setEntries(rows);
          setError(null);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [basePath, subPath]);

  return (
    <div className="border rounded p-2 mt-2">
      <div className="text-xs opacity-70 mb-1">basePath: {basePath}</div>
      <div className="text-xs mb-1">subPath: /{subPath}</div>
      {error && <div className="text-danger text-xs">{error}</div>}
      <ul className="text-sm">
        {subPath && (
          <li>
            <button
              className="underline"
              onClick={() => setSubPath(subPath.split('/').slice(0, -1).join('/'))}
            >
              ..
            </button>
          </li>
        )}
        {entries.map((e) => (
          <li key={e.name}>
            {e.isDirectory ? (
              <button
                className="underline"
                onClick={() => setSubPath(subPath ? `${subPath}/${e.name}` : e.name)}
              >
                {e.name}/
              </button>
            ) : (
              <span className="opacity-60">{e.name}</span>
            )}
          </li>
        ))}
      </ul>
      <button
        className="mt-2 px-3 py-1 bg-accent text-white rounded"
        onClick={() => onChange(subPath)}
      >
        Use this path
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Implement `SourceRow.tsx`**

```tsx
import { useState } from 'react';
import type { Source } from '@tpd/shared';
import { api } from '../../api/client.js';
import { ConnectionBadge, type ConnectionState } from './ConnectionBadge.js';

export function SourceRow({
  source,
  onChange,
  onRemove,
}: {
  source: Source;
  onChange: (s: Source) => void;
  onRemove: () => void;
}) {
  const [conn, setConn] = useState<{ state: ConnectionState; message?: string }>({
    state: 'idle',
  });

  async function test() {
    setConn({ state: 'testing' });
    try {
      const r = await api.testSource(source.type, source.config);
      setConn({ state: r.ok ? 'ok' : 'error', message: r.error });
    } catch (e) {
      setConn({ state: 'error', message: (e as Error).message });
    }
  }

  return (
    <div className="border rounded p-3 mb-2 bg-white/50">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="border px-2 py-1 rounded"
          placeholder="Label"
          value={source.label}
          onChange={(e) => onChange({ ...source, label: e.target.value })}
        />
        <select
          className="border px-2 py-1 rounded"
          value={source.type}
          onChange={(e) => {
            const type = e.target.value as Source['type'];
            const config = type === 'local' ? { path: '' } : {};
            onChange({ ...source, type, config } as Source);
          }}
        >
          <option value="local">local</option>
          <option value="truenas" disabled>truenas (3b)</option>
          <option value="smb" disabled>smb (3b)</option>
          <option value="nfs" disabled>nfs (3b)</option>
          <option value="rclone" disabled>rclone (3b)</option>
        </select>
        {source.type === 'local' && (
          <input
            className="border px-2 py-1 rounded grow"
            placeholder="/absolute/path"
            value={(source.config as { path: string }).path}
            onChange={(e) =>
              onChange({ ...source, config: { path: e.target.value } } as Source)
            }
          />
        )}
        <button className="px-3 py-1 border rounded" onClick={test}>
          Test
        </button>
        <ConnectionBadge state={conn.state} message={conn.message} />
        <button className="px-3 py-1 border rounded text-danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Implement `SourcesList.tsx`**

```tsx
import type { Source } from '@tpd/shared';
import { SourceRow } from './SourceRow.js';

function newId() {
  return `src-${Math.random().toString(36).slice(2, 8)}`;
}

export function SourcesList({
  sources,
  onChange,
}: {
  sources: Source[];
  onChange: (s: Source[]) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Sources</h2>
      {sources.map((s, i) => (
        <SourceRow
          key={s.id}
          source={s}
          onChange={(next) => {
            const copy = [...sources];
            copy[i] = next;
            onChange(copy);
          }}
          onRemove={() => onChange(sources.filter((_, j) => j !== i))}
        />
      ))}
      <button
        className="px-3 py-1 mt-2 bg-accent text-white rounded"
        onClick={() =>
          onChange([
            ...sources,
            {
              id: newId(),
              label: 'New source',
              type: 'local',
              config: { path: '' },
            },
          ])
        }
      >
        Add source
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Implement `SettingsPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { Config } from '@tpd/shared';
import { api } from '../api/client.js';
import { SourcesList } from '../components/Settings/SourcesList.js';

export function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    api.getConfig().then(setConfig);
  }, []);

  if (!config) return <div>Loading…</div>;

  async function save() {
    if (!config) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await api.putConfig(config);
      setConfig(next);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SourcesList
        sources={config.sources}
        onChange={(sources) => setConfig({ ...config, sources })}
      />
      <div className="mt-6 flex items-center gap-3">
        <button
          className="px-4 py-2 bg-accent text-white rounded"
          disabled={saving}
          onClick={save}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saveError && <span className="text-danger text-sm">{saveError}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Wire test setup for happy-dom + jest-dom**

Append to `apps/frontend/vite.config.ts` (replace the existing `test` block):

```ts
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
  },
```

Create `apps/frontend/tests/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 10: Run tests, verify pass**

```bash
npm test
```
Expected: `ConnectionBadge` tests pass.

- [ ] **Step 11: End-to-end smoke**

In one terminal (from repo root):
```bash
npm run dev:backend
```

In a second terminal:
```bash
npm run dev:frontend
```

Open `http://localhost:5173/` in a browser. Expected:
- Page loads with the title "TranscodePipelineDash" and an empty Sources list.
- Click **Add source**, label it "Local test", type `/Users/npalakurla/WorkingFolder` in the path field, click **Test** → badge turns green, "Connected".
- Type `/this/does/not/exist` → click **Test** → badge turns red with the actual error.
- Click **Save** → the row persists. Refresh the browser → row reappears (loaded from `apps/backend/data/config.json`).
- Stop both dev servers.

- [ ] **Step 12: Commit**

```bash
cd ../..
git add apps/frontend
git commit -m "feat(frontend): add Settings page with Sources list, connection tester, local picker"
```

---

## Task 8: Phase 3a Sign-Off

- [ ] **Step 1: Run all tests from the repo root**

```bash
npm test
```
Expected: every workspace's tests pass.

- [ ] **Step 2: Lint clean**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 3: Acceptance checklist**

Confirm observably true:

1. Repo at `/Users/npalakurla/WorkingFolder/TranscodePipelineDash` with workspaces `packages/shared`, `apps/backend`, `apps/frontend`.
2. `GET /api/health` returns `{"ok":true}`.
3. `GET /api/config` returns the default config when no file exists.
4. `PUT /api/config` persists a config and survives backend restart.
5. `POST /api/sources/test` for `local` type with a valid path returns `{ok: true}`; with a bad path returns `{ok: false, error: "..."}`.
6. `POST /api/sources/list` returns directory entries with `isDirectory` flags.
7. Frontend renders the Settings page, adds/removes/edits a `local` source row, runs the connection tester, and saves.
8. Saved config persists across browser refresh and backend restart.
9. All Vitest suites pass; ESLint reports zero errors.

- [ ] **Step 4: Tag the milestone**

```bash
git tag phase-3a-complete
git log --oneline | head -10
```

Expected: a clean linear history with one commit per task.

---

## Self-Review (Phase 3a)

- **Spec coverage:** Configuration view (Sources list, library reference model, connection testers, persistence, hot-reload-able config) is implemented for the `local` source type and the `sources` portion of the schema. `libraries`, additional source types, Plex/Tdarr/SmartKanban groups, encode-target settings, and onboarding wizard are deferred to 3b. The backend's HTTP API surface is the contract the frontend talks to; no mocks substitute for real config persistence.
- **Placeholder scan:** No "TBD"/"TODO". The disabled options for `truenas`/`smb`/`nfs`/`rclone` in `SourceRow.tsx` are explicit "(3b)" placeholders that ship as disabled, not as missing implementation hidden behind hand-waving.
- **Type / name consistency:** `ConfigSchema`, `SourceSchema`, `LibrarySchema` are used consistently across packages. `LocalDriver`, `SourceDriver`, `ValidateResult`, `ListEntry`, `ConfigStore` names match across files and tests. `@tpd/shared`, `@tpd/backend`, `@tpd/frontend` package names are consistent. Routes (`/api/health`, `/api/config`, `/api/sources/test`, `/api/sources/list`) appear with identical shapes in tests and frontend client.
- **Risks:**
  - Path traversal protection in `LocalDriver.list` uses `relative()`; tested for `..` escape but should be re-reviewed when SMB/NFS drivers land since their absolute-path semantics differ.
  - `SourcesList`'s id generation uses `Math.random()` — fine for in-browser uniqueness within a session; if the same config is edited by two users simultaneously in a multi-user scenario, IDs could collide. Single-user dashboard, low risk; revisit if multi-user lands.
  - The frontend currently does no local validation before save — the backend is sole source of truth for schema validity. Acceptable since errors come back with actionable messages, but worth optimistic client-side validation in 3b for snappier UX.
