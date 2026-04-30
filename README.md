# MediaConverter

Live dashboard + transcode pipeline that pre-encodes 4K media on TrueNAS into client-friendly variants for Plex playback across Apple TV, Samsung, LG, iPhone, iPad, and Mac.

Eliminates live Plex transcoding by pre-producing two variants per source (4K HEVC direct-play + 1080p H.264 SDR fallback) using Tdarr orchestration over Apple Silicon Macs (Mac Mini M4 server + MBP M1 node) with VideoToolbox HW encode.

The dashboard observes the pipeline live: Flow topology with animated particles, per-file Kanban drill-down, Settings/onboarding wizard, and an optional SmartKanban digest adapter.

---

## Repo Layout

```
MediaConverter/
├── apps/
│   ├── backend/        Fastify + TypeScript SSE backend
│   ├── frontend/       React + Vite + TypeScript dashboard
│   └── digest/         Hourly cron CLI → posts to SmartKanban
├── packages/
│   └── shared/         zod schemas (Source, Library, Config, PipelineEvent)
└── docs/
    └── superpowers/
        ├── specs/      Approved design spec
        └── plans/      Phase-by-phase implementation plans
```

## What Ships Today (Code Phases)

| Phase | Status | Tag | Scope |
|-------|--------|-----|-------|
| 3a | ✅ | `phase-3a-complete` | Repo skeleton, config schema, ConfigStore, LocalDriver, REST routes, Settings UI |
| 3b | ✅ | `phase-3b-complete` | smb/nfs/truenas drivers, Libraries, Plex/Tdarr/SmartKanban groups, Onboarding wizard |
| 3c | ✅ | `phase-3c-complete` | Tdarr+Plex API clients, SSE pipeline, Mock-mode harness |
| 3d | ✅ | `phase-3d-complete` | Live Flow topology view (zones, lucide icons, animated particles, KPI strip) |
| 3e | ✅ | `phase-3e-complete` | Per-file Kanban drill-down with click-from-Flow filter |
| 4 | ✅ | `phase-4-complete` | SmartKanban digest CLI (`apps/digest`) |

**81 tests passing** across `@tpd/shared`, `@tpd/backend`, `@tpd/frontend`, `@tpd/digest`.

## What's Deferred (Ops Phases — Your Hands Needed)

| Phase | Status | Plan | Scope |
|-------|--------|------|-------|
| 1 | Pending | `docs/superpowers/plans/2026-04-29-01-infrastructure.md` | TrueNAS datasets, SMB user, Plex VM (Ubuntu LTS via Incus + virtiofs) |
| 2 | Pending | `docs/superpowers/plans/2026-04-29-02-tdarr-pipeline.md` | Colima + Docker Tdarr Server, native Tdarr Nodes on M4/M1, encode plugins, fixture pack |

These can't be driven remotely (require physical TrueNAS access + Mac Mini setup).

---

## Quick Start

### Prerequisites

- Node 22 + npm 11
- Docker (only needed if running Tdarr Server locally; not required for the dashboard alone)

### Run the dashboard

```sh
git clone git@github.com:chatwithllm/MediaConverter.git
cd MediaConverter
nvm use            # picks Node 22 from .nvmrc
npm install
```

Two terminals:

```sh
# terminal 1 — backend (fastify on :3100)
MOCK=1 npm run dev:backend

# terminal 2 — frontend (vite on :5173)
npm run dev:frontend
```

Open `http://localhost:5173` → Onboarding wizard appears on first run.

`MOCK=1` makes the backend emit synthetic pipeline events every 3 seconds so the Flow view animates without a real Tdarr/Plex. Drop `MOCK=1` when pointing at real services.

### Run the digest CLI

```sh
cd apps/digest
CONFIG_FILE=../backend/data/config.json npm start
```

Emits a one-line digest summary to your configured SmartKanban card. Suitable for hourly cron / launchd.

### Run all tests

```sh
npm test
npm run lint
```

---

## Continuing on Another Machine

This is the picking-up-from-anywhere recipe. Everything you need is in the repo — no hidden state.

### 1. Clone

```sh
git clone git@github.com:chatwithllm/MediaConverter.git
cd MediaConverter
```

### 2. Restore environment

```sh
nvm install
nvm use
npm install
```

If you don't have nvm, install Node 22 directly. Versions are pinned in `.nvmrc`.

### 3. Read the spec + plans (don't skip)

The single source of truth for *what we're building and why*:

- `docs/superpowers/specs/2026-04-29-truenas-plex-transcode-pipeline-design.md`

The phase-by-phase how-to-build:

- `docs/superpowers/plans/2026-04-29-truenas-plex-transcode-pipeline.md` (parent index)
- Sub-plans for each phase in the same directory

Read in this order: parent plan → spec → whichever sub-plan you're picking up.

### 4. Find where you left off

```sh
git log --oneline -20
git tag --list 'phase-*'
```

The latest tag tells you which phase shipped last. The next sub-plan in `docs/superpowers/plans/` tells you what's next.

### 5. Verify the previous phase still passes before adding to it

```sh
npm test
npm run lint
npm run build
```

If any of those fail, fix before adding new work. Don't pile on top of red.

### 6. Pick up the next phase

Open the relevant `2026-04-29-XX-*.md` plan. Each task uses checkbox (`- [ ]`) syntax. Tasks are bite-sized (2–5 min steps) with exact commands and code blocks.

If using Claude Code (or any agent following the superpowers workflow):

```
/superpowers:subagent-driven-development
```

Then point it at the next plan file.

### 7. Conventions

- **TDD**: red test → green test → commit. Most plans show this pattern explicitly.
- **Commits**: small, prefixed (`feat(backend):`, `fix(flow):`, `chore:`, `docs:`, `test:`). One commit per task.
- **Strict TypeScript**: `exactOptionalPropertyTypes` is on. Use `{...(x !== undefined ? { x } : {})}` for optional fields.
- **Lint flat config**: `eslint.config.js`. ESLint 9.

### 8. Architectural rules to preserve

These are baked into the spec — don't drift:

- Originals are never modified; all destructive operations operate on copies.
- Encode hardware is Apple VideoToolbox (M4 + M1). libx265 software encode is rejected.
- Plex runs in an Ubuntu VM on TrueNAS, not a TrueNAS App.
- The dashboard observes; it does not orchestrate. Tdarr is the orchestrator.
- Sources are pluggable (`local | truenas | smb | nfs | rclone`). Don't hardcode TrueNAS.
- The digest adapter mutates SmartKanban only via `POST /api/cards/{id}/activity`. Schema unchanged.

### 9. If you change the spec

Update `docs/superpowers/specs/2026-04-29-truenas-plex-transcode-pipeline-design.md` and commit it as `docs: ...` BEFORE writing any new plan that depends on the change. The spec is the contract.

### 10. Where credentials live

Nowhere in the repo. The dashboard's runtime config (Plex token, Tdarr API key, SmartKanban token, SMB password) lives at `apps/backend/data/config.json`, which is gitignored. On a fresh clone, the onboarding wizard collects them via the UI and writes that file.

---

## Architecture (one-paragraph)

TrueNAS SCALE stores media and hosts an Ubuntu Plex VM (virtiofs-mounted media). Tdarr Server runs in Docker on Mac Mini M4 and orchestrates encode jobs across native Tdarr Nodes on M4 + MBP M1. Two custom Tdarr plugins produce a 4K HEVC direct-play variant and a 1080p H.264 SDR fallback (with HDR→SDR tonemap). The MediaConverter dashboard observes Tdarr REST + Plex REST, normalizes events into a `PipelineEvent` stream, and serves them to a React frontend over SSE. The frontend renders a live Flow topology (curved bezier arrows, motion-particle data flow, zoned regions) plus a per-file Kanban view. An optional `transcode-digest` cron utility posts hourly summaries to a SmartKanban card.

## Tech Stack

- **Backend**: Fastify 4, TypeScript 5.6, zod, pino, Vitest
- **Frontend**: React 18, Vite 5, TailwindCSS 3, lucide-react, Vitest + Testing Library + happy-dom
- **Shared**: zod schemas (single source of truth for Source/Library/Config/PipelineEvent)
- **Digest**: Node + tsx CLI, depends on `@tpd/backend` clients
- **Infra**: TrueNAS SCALE Electric Eel+, Ubuntu 24.04 LTS, Plex Media Server, Tdarr 2.x, Docker (Colima or OrbStack), HandBrakeCLI + ffmpeg, VideoToolbox

## License

Private project. No license granted.
