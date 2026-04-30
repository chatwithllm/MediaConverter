# TrueNAS → Plex Transcode Pipeline — Parent Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each phase plan task-by-task. Steps in phase plans use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an unattended pipeline that pre-encodes 4K media on TrueNAS into client-friendly Plex variants, with a live Flow/Kanban dashboard and SmartKanban digest.

**Architecture:** TrueNAS SCALE stores media and hosts an Ubuntu Plex VM. Tdarr Server (Mac Mini M4) orchestrates encode jobs across local + remote (MBP M1) Tdarr Nodes using Apple VideoToolbox. A separate React+Fastify dashboard polls Tdarr/Plex APIs and serves a Live Flow topology + per-file Kanban over SSE. A small cron adapter posts hourly digests to a SmartKanban card via the existing REST API.

**Tech Stack:** TrueNAS SCALE (Electric Eel+), Ubuntu Server LTS, Plex Media Server, Tdarr 2.x, Docker (Tdarr Server), HandBrakeCLI + ffmpeg + VideoToolbox, React + TypeScript + Vite, Fastify + TypeScript, Postgres-free (stateless backend), SSE.

**Source spec:** [docs/superpowers/specs/2026-04-29-truenas-plex-transcode-pipeline-design.md](../specs/2026-04-29-truenas-plex-transcode-pipeline-design.md)

---

## Sub-Plan Index (revised — dashboard-first order)

User chose dashboard-first development so the tool itself guides the remaining TrueNAS/Tdarr/Plex setup with its onboarding wizard, instead of all setup happening through chat instructions. The dashboard is built first against mocks, then pointed at real services as they come online.

| # | Phase | Plan File | Status | Depends On |
|---|-------|-----------|--------|------------|
| 3a | Dashboard skeleton (repo, config schema, Settings API + UI, `local` source driver, connection tester) | [2026-04-29-03a-dashboard-skeleton.md](./2026-04-29-03a-dashboard-skeleton.md) | Ready | — |
| 3b | Source drivers (truenas/smb/nfs/rclone), onboarding wizard | _written after 3a lands_ | Pending | 3a |
| 3c | Tdarr + Plex API clients, SSE event pipeline, mock-mode for dev | _written after 3b lands_ | Pending | 3b |
| 3d | Flow view (live topology, animated arrows, pulsing nodes) | _written after 3c lands_ | Pending | 3c |
| 3e | Kanban view (per-file lifecycle drill-down) | _written after 3c lands_ | Pending | 3c |
| 1 | Infrastructure (storage + Plex VM) — guided by dashboard once 3b lands | [2026-04-29-01-infrastructure.md](./2026-04-29-01-infrastructure.md) | Ready (manual ops) | 3b for guidance, otherwise none |
| 2 | Tdarr pipeline (server + nodes + plugins + fixtures) | _written after Phase 1 lands_ | Pending | Phase 1 |
| 4 | SmartKanban digest adapter | _written after Phase 2 lands_ | Pending | Phase 2 |

The dashboard is developed against mock data through 3c. Real-data validation begins once Phase 1 + Phase 2 land, at which point the dashboard's Settings UI replaces chat-driven instructions for environment configuration.

## Why split into four plans

- Each phase is independently shippable: Phase 1 alone gives a working Plex VM with playable library; Phase 2 alone gives auto-transcoded variants visible in Plex; Phases 3 and 4 add visibility layers without affecting media flow.
- Phase 2's plugin config and Phase 3's event shapes depend on inspecting real Tdarr 2.x responses on the actual hardware. Writing those task lists before Phase 1 runs would risk drift; the user might be on a Tdarr release whose API differs subtly from documented examples.
- Failure isolation: a problem in Phase 3 (UI) does not leave the pipeline broken.

## Cross-cutting prerequisites (verify before Phase 1)

The user supplies these. None are produced by the plan.

- [ ] TrueNAS SCALE up and reachable on the LAN with admin access. Version Electric Eel (24.10) or newer.
- [ ] A pool with at least 3× the size of the existing 4K library free (variant tiers).
- [ ] Mac Mini M4 always-on, on the same LAN, signed in, sleep/screen-saver disabled while plugged in.
- [ ] MacBook Pro M1, same LAN when home, full-disk-access for HandBrakeCLI granted (System Settings → Privacy & Security).
- [ ] SmartKanban deployed and reachable from the Mac Mini, with an `api`-scoped token (see SmartKanban README) and the id of the "Media Pipeline" card to receive digests. (Phase 4 only.)
- [ ] DNS or static IPs for: TrueNAS host, Plex VM, Mac Mini, SmartKanban host. Pipeline targets cross-machine SMB and HTTP — flaky DHCP renames will break worker mounts.

## Cross-cutting decisions already locked

These are baked in across all sub-plans:

- Originals are never modified; all destructive operations operate on copies.
- Library uses Plex `{edition-...}` multi-version naming for stacking variants.
- Encode hardware is Apple VideoToolbox (M4 + M1). Software libx265 is rejected for runtime cost.
- Plex runs in an Ubuntu LTS VM on TrueNAS, not in a TrueNAS App.
- Dashboard is a separate web app, not a SmartKanban extension.
- Digest adapter mutates only via SmartKanban's existing `POST /api/cards/{id}/activity` endpoint.

---

## Self-review (parent plan)

- **Spec coverage:** Constraints 1–6, architecture, library layout, encode rules, trigger flow, error handling, testing, visibility, digest — every section maps to one of Phases 1–4. Storage layout + Plex VM in Phase 1; encode rules + trigger flow + error handling in Phase 2; visibility + dashboard in Phase 3; digest in Phase 4.
- **Decomposition:** Each phase is independently testable and ships value alone.
- **Cycles:** None. Phase 2 depends on Phase 1; Phases 3 and 4 each depend on Phase 2; no edge runs backwards.
- **Open follow-ups:** None at the parent level. Sub-plan-specific risks live in their own self-review sections.
