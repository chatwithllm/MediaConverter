# TrueNAS → Plex Transcode Pipeline — Design

**Date:** 2026-04-29
**Status:** Approved (pending user review of this document)

## Problem

4K content on TrueNAS plays poorly across the household's Plex clients (Apple TV, Samsung TV, LG, iPhone, iPad, Mac). Symptoms are a mix: server CPU saturates during live transcode, codec/container/audio combinations break direct-play on certain clients, and HDR sources can look wrong on SDR endpoints. Current setup forces the Plex Media Server to transcode at watch time, which the host cannot keep up with.

## Goals

- Eliminate live transcoding by pre-encoding every 4K source into client-friendly variants.
- Preserve original 4K masters untouched.
- Direct-play (no transcode session) on every target client: Apple TV 4K, Samsung Tizen, LG webOS, iPhone, iPad, Mac.
- Workflow runs unattended: drop file in library, transcoded variants appear, Plex picks them up.
- Survive failures: corrupt sources, encoder crashes, network drops, full disks.

## Non-Goals

- Remote streaming optimization (focus is LAN clients).
- Live TV / DVR transcoding.
- Audio-only / music library handling.
- Replacing or competing with Plex's own transcoder for edge cases.

## Constraints (decisions locked during brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Failure mode driving design | Worst-case mix: CPU pegs + codec/container incompat + HDR tonemap |
| 2 | Storage strategy | Keep original + add 4K HEVC direct-play variant + add 1080p SDR fallback (≈3× storage per title) |
| 3 | Encode hardware | Mac Mini M4 (always-on, primary worker) + MBP M1 (optional secondary node when home). Both use Apple VideoToolbox. TrueNAS does not encode. |
| 4 | Orchestrator | Tdarr (server + nodes architecture, plugin-driven rules) |
| 5 | Plex placement | Dedicated Ubuntu LTS VM on TrueNAS SCALE running Plex `.deb` (skip TrueNAS app to avoid past instability) |
| 6 | Visibility / dashboards | Two-layer: dedicated `TranscodePipelineDash` web app for live lifecycle view + small adapter that posts digest entries into existing SmartKanban "Media Pipeline" card via SmartKanban REST API (pattern borrowed from `notetaker-kanban`) |

Originals are never modified. All destructive operations happen on copies.

## Architecture

```
TrueNAS SCALE host
┌────────────────────────────────────────────────────────────┐
│ ZFS pool: /mnt/tank/media                                  │
│   /movies/                                                 │
│   /tv/                                                     │
│   /_staging/    (atomic move target before final placement)│
│   /_failed/     (quarantine for unprocessable sources)     │
│                                                            │
│ ┌────────────────────────────────┐                         │
│ │ Plex VM (Ubuntu Server LTS)    │                         │
│ │  - Plex Media Server (.deb)    │                         │
│ │  - virtiofs mount → /media     │                         │
│ │  - 2 vCPU, 4 GB RAM            │                         │
│ │  - Static IP on LAN            │                         │
│ └────────────────────────────────┘                         │
└────────────────────────────────────────────────────────────┘
        ▲                                    ▲
        │ SMB read/write (tdarr user)        │ (virtiofs internal)
        │                                    │
┌──────────────────────────────────┐    ┌──────────────────┐
│ Mac Mini M4 (always)             │    │ MBP M1 (optional)│
│  - Tdarr Server                  │◄──┤│  - Tdarr Node    │
│  - Tdarr Node (local)            │ LAN│  - native        │
│  - Docker (server)               │    │    HandBrakeCLI  │
│  - VideoToolbox                  │    │  - VideoToolbox  │
│  - TranscodePipelineDash backend │    └──────────────────┘
│    (Fastify, polls Tdarr+Plex,   │
│     pushes SSE to browser)       │
│  - transcode-digest cron         │
│    (hourly → SmartKanban REST)   │
└──────────────────────────────────┘
                │ HTTPS
                ▼
┌──────────────────────────────────┐
│ Browser (laptop / phone / iPad)  │
│  - TranscodePipelineDash UI      │
│    (React, SSE, Kanban lifecycle)│
└──────────────────────────────────┘

                ┌─────────────────────────────────────┐
                │ SmartKanban (existing, untouched)   │
                │  - "Media Pipeline" card            │
                │  - Activity entries from cron       │
                │    "3 done, 1 failed overnight"     │
                │  - Family-glance visibility         │
                └─────────────────────────────────────┘
```

### Components

- **TrueNAS SCALE** — storage substrate. Hosts the Plex VM and exports media via SMB to the Mac workers. ZFS snapshots provide accidental-delete protection.
- **Plex VM** — isolates Plex from TrueNAS app system churn. Mounts `/mnt/tank/media` via virtiofs (lower overhead than SMB-back-to-host). Installed from Plex `.deb`, auto-updated via the Plex APT repo.
- **Tdarr Server (Mac Mini M4)** — single source of truth for the library scan, rules engine, job queue, web UI, and history database. Runs in Docker. Mounts the SMB share at `/media` inside the container.
- **Tdarr Node (Mac Mini M4)** — colocated worker on the always-on box. Native install (not Docker) so VideoToolbox is reachable without GPU passthrough complications.
- **Tdarr Node (MBP M1)** — secondary native worker. Joins the server when on the LAN. Tdarr handles intermittent availability gracefully — jobs route to whichever node is online.
- **HandBrakeCLI / ffmpeg** — invoked by Tdarr nodes. ffmpeg is preferred for the HDR→SDR tonemap chain; HandBrakeCLI for everything else.
- **TranscodePipelineDash** — separate web app (own repo). React + TypeScript + Vite frontend, Fastify + TypeScript backend. Borrows the SmartKanban design tokens (`theme.css`, color palette, SoDoSans typography) so it visually belongs to the same family. Backend has no database — pipeline state is sourced live from Tdarr API + Plex API + filesystem. Frontend receives updates over SSE.
- **transcode-digest adapter** — small CLI utility (modeled on `notetaker-kanban`'s `bin/notetaker-flush` + `lib/api.sh`) that runs hourly via cron on the Mac Mini. Queries Tdarr's history DB for completed/failed jobs since the last run and posts a one-line activity entry to the "Media Pipeline" card in SmartKanban via the existing `/api/cards/{id}/activity` endpoint. Stateless aside from a `last_run_ts` checkpoint file. Does not modify SmartKanban schema or behavior.

## Library Layout

Per title, three files coexist using Plex's official multi-version `{edition-...}` naming:

```
/movies/Dune (2021)/
  Dune (2021) {edition-Original 4K HDR}.mkv
  Dune (2021) {edition-4K HEVC Direct Play}.mkv
  Dune (2021) {edition-1080p SDR}.mkv

/tv/Severance/Season 02/
  Severance - S02E01 {edition-Original 4K HDR}.mkv
  Severance - S02E01 {edition-4K HEVC Direct Play}.mkv
  Severance - S02E01 {edition-1080p SDR}.mkv
```

Plex stacks these as alternate versions of the same media item. Clients select the best fit for their decode capability and available bandwidth.

## Encode Rules

Each source is probed (`ffprobe`) and matched against the table below. Outputs are produced in parallel as separate Tdarr sub-jobs.

| Source signature | Output 1 — 4K direct-play | Output 2 — 1080p fallback |
|------------------|---------------------------|---------------------------|
| 4K HEVC 10-bit HDR + Atmos/TrueHD | HEVC 10-bit, HDR10 passthrough, ≈25 Mbps, hvc1 tag, original audio kept + AAC 2.0 stereo track added | H.264 8-bit, HDR→SDR tonemap (zscale + hable), 1080p, ≈8 Mbps, AAC 2.0 stereo |
| 4K H.264 8-bit SDR | HEVC 10-bit, ≈20 Mbps, AAC 2.0 stereo | H.264 8-bit, 1080p, ≈6 Mbps, AAC 2.0 stereo |
| Source already ≤1080p | (skip — no 4K variant generated) | If not already H.264 + AAC, normalize. Else skip. |
| Source already HEVC ≤25 Mbps + AAC stereo | (skip — passes direct-play) | Generate 1080p only if missing |

### Encoder commands (reference)

4K HEVC direct-play:
```
ffmpeg -i IN.mkv \
  -c:v hevc_videotoolbox -b:v 25M -tag:v hvc1 -profile:v main10 \
  -map 0:a -c:a copy \
  -map 0:a:0 -c:a aac -ac 2 -b:a 192k \
  -map 0:s? -c:s copy \
  OUT.mkv
```

1080p H.264 SDR fallback (HDR source):
```
ffmpeg -i IN.mkv \
  -vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,scale=1920:-2" \
  -c:v h264_videotoolbox -b:v 8M -profile:v high -level 4.1 \
  -map 0:a:0 -c:a aac -ac 2 -b:a 192k \
  -map 0:s? -c:s copy \
  OUT.mkv
```

VideoToolbox is chosen for speed and zero CPU pressure on the Mac. Quality is acceptable at the chosen bitrates; libx265 software encode is rejected because it would saturate the M4 for hours per file.

## Trigger Flow

```
1. User drops new file → /mnt/tank/media/movies/<Title>/<source>.mkv
2. Tdarr Server scans library every 15 min (configurable; on-demand also available)
3. New hash detected → ffprobe → match rules table
4. Job split into sub-jobs: 4K-HEVC + 1080p-SDR (or fewer if rules skip)
5. Tdarr dispatches each sub-job to the first available node (Mac Mini > MBP)
6. Worker copies source to local /tmp/tdarr-work/<job-id>/, encodes locally
7. ffprobe verifies output (duration ±1 s of source, expected codec/profile, no read errors)
8. Atomic move: /tmp → SMB /_staging/<job-id>/ → final title directory
9. Post-process plugin POSTs to Plex partial-scan webhook for the affected library section
10. On any failure: source → /_failed/, full ffmpeg log retained, Tdarr retry counter increments
```

State tracking: Tdarr's history DB indexes processed files by hash. Re-runs do not re-encode existing outputs. Replacing a source produces a new hash → new job.

## Visibility — TranscodePipelineDash

The dashboard has two views, both fed by one SSE stream from the backend.

### Primary view: Live Flow (system topology)

A hand-laid SVG topology of the pipeline, modeled on a CI/CD-style flow diagram. Every component is an icon-card with a live counter. Arrows between components animate when data is moving.

```
                      ┌─────────────────────────────────────────────┐
                      │  TranscodePipelineDash — Live Flow          │
                      └─────────────────────────────────────────────┘

   [TrueNAS]                                                         [Plex VM]
   ┌──────┐  scan         ┌──────┐  dispatch    ┌────────┐  publish  ┌──────┐
   │ 📦   │ ───────────►  │ 🎛️   │ ───────────► │ 🍎 M4  │ ─────────►│ ▶︎    │
   │ ZFS  │   3 new        │Tdarr │  job #218    │encoding│   move    │ Plex │
   │media │               │server│              │ Dune   │           │      │
   └──────┘               └──────┘              └────────┘           └──────┘
      │                       │                     │
      │                       │  dispatch           │
      │                       └────────────►  ┌────────┐
      │                       (when home)     │ 💻 M1  │
      │                                       │encoding│
      │                                       │ Tenet  │
      │                                       └────────┘
      │
      └──── (filesystem watch _failed/) ────► [Failed Quarantine 🚨]


  Legend: solid border = active now    dashed flowing arrow = data moving
          gray + pulse = idle           red = error
```

Visual behavior:

- Each component card carries icon + label + live counter (e.g., "Tdarr: 3 queued, 2 encoding").
- **Active node:** pulse ring via `box-shadow` keyframes; border color switches from gray to SmartKanban green.
- **Arrows:** inline SVG paths with `stroke-dasharray: 8 8` and animated `stroke-dashoffset` so dashes flow in the direction of data movement; animation pauses when idle.
- **File transfer badge:** a small chip slides along the arrow during an atomic move from `_staging/` to the final directory, labeled with the title.
- **Failure path:** red arrow lights up only when a file lands in `_failed/`, dims after 30 s.
- **MBP M1 node:** rendered as a faded card with a "offline" tag when not on the LAN; transitions to active card when reachable.
- **Click any node:** drills into the Kanban view filtered to that node's current state.

Tech notes:

- React + framer-motion (or plain CSS keyframes) for pulses and slide-ins.
- Inline SVG topology with hand-laid coordinates — 5–6 nodes, stable layout, no graph engine needed.
- Icon set: Lucide or Heroicons, recolored to SmartKanban's palette; product logos (Plex, Tdarr) inlined as branded SVGs where licensing permits.

### Configuration view (Settings)

A third view holds all runtime parameters. Nothing in the dashboard is hardcoded; everything that varies per environment is entered here, persisted on the backend, and editable.

Fields:

| Group | Field | Notes |
|-------|-------|-------|
| Sources | Source list | **list, add/remove/reorder rows**. Each row has a `type` and type-specific config (see "Source types" below). At least one source required. |
| Library | Library list | **list, add/remove rows** — each row is `{label, source ref, path within source, library type (movie/tv/other)}`. Multiple libraries can reference the same source. |
| Plex | Server URL | e.g. `http://192.168.50.42:32400` |
| Plex | API token | stored encrypted at rest |
| Plex | Library section ids | auto-discovered after token validates; user maps each TrueNAS source to a Plex section |
| Tdarr | Server URL | e.g. `http://192.168.50.50:8265` |
| Tdarr | API key (if 2.x auth enabled) | encrypted at rest |
| Tdarr | Worker nodes | **list, auto-discovered from Tdarr Server**; user can rename / mark "always-on" / "intermittent" labels for the Flow view |
| SmartKanban | Server URL | e.g. `http://192.168.1.50:3001` |
| SmartKanban | API token (`api` scope) | encrypted at rest |
| SmartKanban | Digest card id | dropdown populated after token validates |
| Encode targets | 4K HEVC bitrate, 1080p H.264 bitrate, audio AAC bitrate | numeric, with sane defaults (25/8/0.192 Mbps) |
| Encode targets | Tonemap algorithm | dropdown: `hable` (default), `mobius`, `reinhard` |
| Variants | Enable 4K HEVC direct-play variant, Enable 1080p SDR variant | toggles |
| Cron | Digest interval | dropdown: `15m`, `1h` (default), `6h`, `daily` |
| UI | Reduced motion | toggle |

### Source types (pluggable)

The pipeline does not assume TrueNAS. A "source" is any reachable filesystem the workers can read and write. Initial supported types:

| Type | Required fields | How workers reach it | Notes |
|------|-----------------|----------------------|-------|
| `local` | `path` (absolute) | direct filesystem on the worker host | Use when media lives on the dashboard host or the worker Mac itself (USB drive, internal disk, locally-mounted external NAS share). |
| `truenas` | `host`, `share` (SMB share name), `username`, `password` | SMB mount on each worker | Includes optional SSH host/user fields for live ops (snapshot, dataset listing in the path picker). |
| `smb` | `host`, `share`, `username`, `password`, optional `domain` | SMB mount | Generic SMB/CIFS — Synology, QNAP, Windows, any SMB target. |
| `nfs` | `host`, `export_path`, optional `version` | NFS mount on each worker | Lower overhead than SMB for Linux/macOS clients on the same LAN. |
| `rclone` | rclone remote name + config blob | rclone mount on each worker | For cloud or exotic backends; expect higher latency, may require `vfs-cache-mode=full`. |

Each library row references **one source by id** plus a `path within source`. So the same TrueNAS source can host multiple libraries (e.g., movies, tv, anime) each pointing at a different sub-path.

Adding a new source type later (e.g., `webdav`, `s3`) is a matter of implementing one driver interface — `mount(workerId)`, `unmount(workerId)`, `list(path)`, `validate()` — without touching the rest of the pipeline.

### Onboarding and connection testers

UX details:

- **Onboarding wizard** the first time the dashboard runs (no config saved yet): walks the user through Sources → Libraries → Plex → Tdarr → SmartKanban → Encode targets, with a "Test connection" button at each step that validates before letting the user proceed.
- **Source-type-aware path picker:** for `local` sources, the picker browses the dashboard host's filesystem. For `truenas` with SSH credentials, it lists ZFS datasets via SSH. For `smb`/`nfs`, it lists directories via the mounted share. For `rclone`, it lists via `rclone lsd`.
- **Connection testers** live next to every host field: green check, red X with the actual error message, never silent.
- **Edit any field later** without restart; changes hot-reload the relevant pollers and remount sources only when the source config itself changes.
- **Environment-driven defaults:** on first run the dashboard inspects its host (hostname resolution for `truenas.local`, presence of `/Volumes/*` SMB mounts on macOS, common NFS exports) and pre-fills suggestions where it can detect them. User accepts or overrides; no autodetect ever overwrites saved config.

Persistence:

- Backend stores config in a single JSON file at `./data/config.json` (or `$XDG_CONFIG_HOME/transcode-pipeline-dash/config.json` if set).
- Secrets (Plex token, Tdarr API key, SmartKanban token, SSH key passphrase) are encrypted with a key derived from a startup-time master passphrase or, on macOS, from the user's Keychain.
- Schema versioned (`config.schemaVersion: 1`) so future migrations are explicit.

### Secondary view: Lifecycle Kanban (per-file detail)

```
┌────────────┬─────────┬──────────────┬──────────────┬──────────┬──────────┬────────┐
│ Discovered │ Queued  │ Encoding @M4 │ Encoding @M1 │ Verifying│ In Plex  │ Failed │
│ (TrueNAS)  │ (Tdarr) │              │              │          │          │        │
└────────────┴─────────┴──────────────┴──────────────┴──────────┴──────────┴────────┘
```

A card per file. Cards auto-progress left → right with a slide animation as Tdarr/Plex events arrive. No drag-drop — the pipeline is the source of truth, the UI only reflects it. Used for drill-down from the Flow view and for queue-depth / history inspection.

### Card content

- Title and source filename
- Source codec / resolution / HDR / audio summary
- Target variants and their per-variant progress bars while encoding
- ETA (Tdarr-reported) and elapsed time
- Worker node assignment (M4 / M1)
- File size delta after encode (e.g., `38 GB → 22 GB`)
- Action menu: open Tdarr job page, view ffmpeg log, requeue, ignore

### Data sources (backend)

| Source | Endpoint | Purpose | Poll interval |
|--------|----------|---------|---------------|
| Tdarr REST | `/api/v2/status`, `/api/v2/cruddb` | live queue, node assignments, job state, history | 5 s |
| Tdarr WebSocket | (if available in current Tdarr version) | progress events without polling | streaming |
| Plex API | `/library/sections/{n}/recentlyAdded`, `/library/sections/{n}/all` | confirm files visible to Plex | 30 s |
| Filesystem | watch `_staging/`, `_failed/` via `chokidar` | atomic-move and quarantine signals | event-driven |

### Frontend → backend

- Single SSE stream `/events` carries one normalized event per pipeline transition
- Event payload: `{file_id, title, stage, node?, progress?, eta?, ts}`
- Frontend keeps an in-memory map keyed by `file_id`; column = `stage`

### Visual style (shared across both views)

- Theme tokens (palette, type, spacing) copied from SmartKanban — feels like one product family
- Flow view: 600 ms pulse rings on active nodes, continuous arrow dash flow at 1.2 s loop, 400 ms slide for transfer badges
- Kanban view: 200 ms slide + cross-fade between columns
- Success: green pulse on card border when arriving in "In Plex" (Kanban) or on Plex node (Flow)
- Failure: red shake on entering "Failed" / on Failed Quarantine node, tooltip with error
- Idle: dim components, header counters, cards older than 24 h faded
- Reduced-motion preference (`prefers-reduced-motion`) disables continuous animations and shows static state badges instead

### Auth

- LAN-only by default; Fastify bound to private interface
- Optional Tailscale exposure for remote access
- No multi-user model in v1 (single household operator)

### Deploy

- `docker compose up` on Mac Mini M4 alongside the Tdarr Server container
- Or native `node` + `pm2` if Docker overhead is unwanted

## Digest into SmartKanban

A small adapter (`transcode-digest`) bridges the pipeline to SmartKanban for at-a-glance family visibility.

- Runs once per hour via launchd / cron on the Mac Mini
- Queries Tdarr's history via REST (`/api/v2/cruddb` with a `History` query) filtered to `completed_at > last_run_ts`
- Aggregates: counts of `done`, `failed`, total minutes saved vs live transcode estimate
- POSTs one activity entry to a single SmartKanban card (id stored in config) using the existing `POST /api/cards/{id}/activity` endpoint
- Authenticates with a SmartKanban `api`-scoped token (read/write)
- Failure mode: log only, never block — SmartKanban being down does not affect the pipeline

Example activity body: `"Last hour: 2 movies converted (Dune 4K HDR, Tenet 4K HDR), 0 failed. Total saved: 23 GB. Avg encode: 18 min @ M4."`

This adapter is intentionally minimal. SmartKanban is not the primary view; the dashboard is. The digest is a courtesy log so non-technical family members see activity in the app they already use.

## Error Handling

| Failure | Behavior |
|---------|----------|
| ffprobe cannot read source | Mark "unprocessable", move to `/_failed/`, Tdarr alert in UI |
| Encode crashes (worker process exits) | Tdarr requeues to alternate node, max 3 retries before quarantine |
| Output verify fails (duration mismatch, codec mismatch, truncated file) | Discard output, mark sub-job failed, original untouched |
| SMB connection drops mid-encode | Local `/tmp` work survives, retry on reconnect; final move waits |
| TrueNAS pool full | Tdarr healthcheck fails fast, queue paused, notification sent |
| Plex scan webhook fails | Logged only — Plex's hourly auto-scan picks up the file eventually |
| HDR tonemap looks wrong on a specific title | Manual override: add file to Tdarr ignore list, hand-tune ffmpeg invocation |
| TranscodePipelineDash backend down | Browser shows last-known state with a "stale" banner; pipeline encoding continues unaffected |
| Tdarr API unreachable from dashboard | Backend marks columns "no data" rather than emptying the UI; auto-recovers on reconnect |
| SmartKanban down or token expired | `transcode-digest` logs the error and skips that hour; next run re-includes the missed window |

## Security Notes

- SMB share for Tdarr uses a dedicated `tdarr` user with read/write only on `/mnt/tank/media`. No root, no admin shares.
- Plex VM credentials stored in TrueNAS VM disk only; Plex `.deb` updated via official APT repo (signed).
- Tdarr web UI bound to LAN only; no port-forward. Reverse-proxy behind Tailscale or similar if remote access is ever needed.
- VideoToolbox runs in user space on macOS — no special entitlements required.

## Testing Strategy

A fixture library is processed end-to-end before pointing Tdarr at the full collection.

| Fixture | Source | Expected outputs |
|---------|--------|------------------|
| fixture-1 | 4K HEVC HDR10 + TrueHD Atmos | 4K HEVC direct-play (HDR retained) + 1080p H.264 SDR (tonemapped) |
| fixture-2 | 4K H.264 8-bit SDR | 4K HEVC direct-play + 1080p H.264 |
| fixture-3 | 1080p HEVC 10-bit | No 4K variant; 1080p variant skipped (already direct-play) |
| fixture-4 | Corrupt MKV (truncated, bad header) | No output; source quarantined to `/_failed/`; alert raised |
| fixture-5 | TV show, 5 episodes 4K HDR | Parallel dispatch across both nodes; all outputs valid |

### Acceptance per fixture

1. Variants produced (or correctly skipped) per the rules table.
2. ffprobe on each output confirms expected codec, profile, bit depth, and HDR metadata where applicable.
3. Plex direct-plays each variant on every target client: Apple TV 4K (tvOS), Samsung Tizen, LG webOS, iPhone, iPad, Mac.
4. Plex dashboard shows zero transcode sessions during playback.
5. HDR variant retains HDR badge on Apple TV; 1080p variant plays SDR everywhere.
6. Failure fixture (fixture-4) produces no partial output and original is intact.
7. **Dashboard — Flow view:** during fixture-5, all five files appear as transfer badges sliding along the TrueNAS → Tdarr → M4/M1 → Plex arrows; M4 and M1 nodes both pulse "active" simultaneously when the MBP is online; arrows dim and pulses stop when the run completes.
8. **Dashboard — Kanban view:** clicking the M4 node from Flow filters Kanban to only M4-assigned cards; cards advance through columns in real time and land in "In Plex" after Plex scan completes.
9. **Digest:** after fixtures complete, `transcode-digest` posts one activity entry to the configured SmartKanban "Media Pipeline" card summarizing the run; entry is visible in SmartKanban UI on next refresh.

## Open Questions / Risks

- **VideoToolbox quality at 25 Mbps HEVC** — adequate for most content, but film grain and dark scenes may show banding. Mitigation: bump bitrate per-title via Tdarr override if needed; libx265 fallback as last resort.
- **Atmos / TrueHD passthrough** — the 4K direct-play variant keeps original audio plus an AAC stereo track. Apple TV with AVR should bitstream Atmos; LG/Samsung typically fall back to AAC. Verify on each TV during fixture testing.
- **virtiofs vs SMB for the Plex VM** — virtiofs is faster and recommended; if SCALE's libvirt build proves unstable, fall back to SMB mount inside the VM.
- **Tdarr Docker on macOS** — Docker Desktop on Apple Silicon is fine for the Tdarr server (no encode work in the container). The Tdarr Node stays native to keep VideoToolbox direct.
- **Storage pressure** — 3× footprint adds up. Plan for a ZFS dataset quota or tier movement (e.g., move "Original 4K HDR" copies to slower spinning disks once direct-play variants exist).
- **Tdarr WebSocket availability** — current Tdarr versions expose status over REST cleanly; some builds also provide WebSocket events. If WebSocket is unavailable, dashboard falls back to 5 s polling with no functional loss, only slightly higher CPU.
- **SmartKanban API stability** — digest adapter is the only coupling. If SmartKanban changes its `/api/cards/{id}/activity` endpoint, the adapter updates in isolation; nothing else breaks.

## Out of Scope (deferred)

- Automatic deletion of originals once direct-play variants verify (could be a future plugin).
- Per-client device profile auto-tuning (Tdarr does not introspect client capabilities; rules are static).
- Audio-only / music libraries.
- Subtitle OCR / forced-track extraction beyond passthrough.
