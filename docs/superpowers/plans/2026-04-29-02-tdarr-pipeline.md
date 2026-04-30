# Phase 2 — Tdarr Pipeline (Server, Nodes, Plugins, Fixtures)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Tdarr orchestrator that auto-encodes media on the SMB share Phase 1 created — Tdarr Server in Docker on the always-on Mac Mini M4, Tdarr Nodes natively on Mac Mini M4 + MacBook Pro M1, encode plugins for 4K HEVC direct-play + 1080p H.264 SDR fallback variants per the source spec, and a fixture-driven validation pass.

**Architecture:** Tdarr Server runs in Docker (Colima or OrbStack) on the Mac Mini and serves the web UI on `:8265`. Nodes run **natively** (not in Docker) on each Mac so they have direct access to Apple VideoToolbox without GPU passthrough complications. Both Macs SMB-mount `tank/media` from TrueNAS at `/Volumes/media` (autofs entry survives reboot/sleep). Tdarr libraries are configured to scan `/Volumes/media/movies` and `/Volumes/media/tv`. Encode plugins are a small set of community plugins + one custom plugin written in this phase. Five fixtures validate the rules table from the spec.

**Tech stack:**
- Docker (Colima or OrbStack) on Mac Mini M4
- Tdarr Server v2.x (Docker image `haveagitgat/tdarr`)
- Tdarr Node v2.x (native binaries from tdarr.io for macOS arm64)
- HandBrakeCLI 1.8+ and ffmpeg 7+ from Homebrew
- VideoToolbox (built into macOS — `hevc_videotoolbox`, `h264_videotoolbox`)
- launchd for node auto-start
- macOS `autofs` for stable SMB mounts

**Source spec:** [docs/superpowers/specs/2026-04-29-truenas-plex-transcode-pipeline-design.md](../specs/2026-04-29-truenas-plex-transcode-pipeline-design.md)

**Parent plan:** [2026-04-29-truenas-plex-transcode-pipeline.md](./2026-04-29-truenas-plex-transcode-pipeline.md)

**Prerequisites (must be done before Phase 2 starts):**

- [ ] Phase 1 complete (TrueNAS datasets, `tdarr` SMB user, `media` share, Plex VM running and reachable). Tag `phase1-complete` exists.
- [ ] Mac Mini M4 reachable on LAN, signed in, sleep/screen-saver disabled while plugged in.
- [ ] MBP M1 reachable on LAN when home; full-disk-access granted to Terminal so HandBrakeCLI can read `/Volumes/media`.
- [ ] Both Macs have Homebrew installed.
- [ ] Dashboard onboarding wizard already used to validate the SMB credentials work from Mac Mini (use the dashboard's "Test connection" button on the source row).

---

## File / Resource Structure

This phase creates infrastructure and configuration. Resources:

| Resource | Type | Host |
|----------|------|------|
| Colima or OrbStack VM | Docker engine | Mac Mini M4 |
| `tdarr-server` container | Docker container | Mac Mini M4 |
| `tdarr-node` (m4) | Native macOS daemon | Mac Mini M4 |
| `tdarr-node` (m1) | Native macOS daemon | MBP M1 |
| `/Volumes/media` | autofs SMB mount | both Macs |
| `~/tdarr-server-data` | Tdarr Server data dir | Mac Mini M4 |
| `~/tdarr-node-config` | Tdarr Node config | both Macs |
| `~/Library/LaunchAgents/com.tdarr.node.plist` | launchd unit | both Macs |
| `Tdarr_Plugin_tpd_4k_hevc_directplay.js` | custom plugin | Tdarr Server library |
| `Tdarr_Plugin_tpd_1080p_h264_sdr.js` | custom plugin | Tdarr Server library |

Plus this phase only edits two files in the docs repo:

- Append to `docs/ops-log.md` (created in Phase 1)

No application code changes. The dashboard already supports Tdarr server URL + API key.

---

## Task 1: Install Docker engine on Mac Mini M4 (Colima)

**Resource:** Colima VM running Docker daemon

- [ ] **Step 1: Install Colima + Docker CLI on Mac Mini M4**

```bash
brew install colima docker docker-compose
colima start --cpu 2 --memory 4 --vm-type vz --mount-type virtiofs
```

Verify:
```bash
docker version
```
Expected: client + server versions printed, no errors.

- [ ] **Step 2: Make Colima auto-start on login**

```bash
brew services start colima
```

Verify:
```bash
brew services list | grep colima
```
Expected: status `started`.

- [ ] **Step 3: Smoke test**

```bash
docker run --rm hello-world
```
Expected: hello-world banner.

- [ ] **Step 4: Log it**

Append to `docs/ops-log.md` from your Mac Mini M4:
```bash
echo "$(date -Iseconds)  phase2: colima + docker installed on mac mini m4" >> docs/ops-log.md
git -C /path/to/docs-repo add docs/ops-log.md
git -C /path/to/docs-repo -c user.email=chatwithllm@gmail.com -c user.name=npalakurla commit -m "ops: log colima install on mac mini"
```

---

## Task 2: Provision SMB autofs mount on both Macs

**Resource:** `/Volumes/media` mount surviving reboot and sleep

- [ ] **Step 1: Save SMB credentials in Keychain (Mac Mini M4 first, then MBP M1)**

Open Finder → **Go → Connect to Server** → enter `smb://<TRUENAS_HOST>/media`. Authenticate as the `tdarr` user; check **Remember this password in my keychain**. Confirm the share mounts and the four directories appear.

Eject after verifying — autofs will re-mount on demand.

- [ ] **Step 2: Configure `auto_master`**

```bash
sudo tee -a /etc/auto_master >/dev/null <<'EOF'
/-                     auto_smb_media   -nosuid
EOF
```

Verify:
```bash
tail -2 /etc/auto_master
```

- [ ] **Step 3: Create the autofs map**

```bash
sudo tee /etc/auto_smb_media >/dev/null <<EOF
/Volumes/media -fstype=smbfs,soft ://tdarr@<TRUENAS_HOST>/media
EOF
```

(Substitute `<TRUENAS_HOST>` with the actual host or IP.)

- [ ] **Step 4: Reload autofs**

```bash
sudo automount -vc
```

Verify:
```bash
ls /Volumes/media
```
Expected: `_failed`, `_staging`, `movies`, `tv`.

- [ ] **Step 5: Repeat steps 1–4 on the MBP M1**

- [ ] **Step 6: Smoke-write from each worker**

```bash
echo $(hostname) > "/Volumes/media/_staging/.mount-test-$(hostname)"
ls -l "/Volumes/media/_staging/.mount-test-$(hostname)"
rm "/Volumes/media/_staging/.mount-test-$(hostname)"
```

Expected: file created, listed, removed without error.

- [ ] **Step 7: Log it**

Append to ops log:
```
phase2: /Volumes/media autofs mount working on mac mini + mbp m1
```

---

## Task 3: Run Tdarr Server in Docker on Mac Mini M4

**Resource:** `tdarr-server` container reachable on `http://<MAC_MINI_HOST>:8265`

- [ ] **Step 1: Create the data directory**

```bash
mkdir -p ~/tdarr-server-data/{server,configs,logs,transcode-cache}
```

- [ ] **Step 2: Write a `compose.yml`**

`~/tdarr-server-data/compose.yml`:
```yaml
services:
  tdarr-server:
    image: haveagitgat/tdarr:latest
    container_name: tdarr-server
    restart: unless-stopped
    ports:
      - "8265:8265"   # web UI
      - "8266:8266"   # node API
    environment:
      - TZ=America/New_York
      - PUID=501
      - PGID=20
      - serverIP=0.0.0.0
      - serverPort=8266
      - webUIPort=8265
    volumes:
      - ./server:/app/server
      - ./configs:/app/configs
      - ./logs:/app/logs
      - ./transcode-cache:/temp
      - /Volumes/media:/media
```

- [ ] **Step 3: Boot it**

```bash
cd ~/tdarr-server-data
docker compose up -d
docker compose logs -f tdarr-server
```

Expected: server starts, log shows "ListeningOnPort: 8265".

- [ ] **Step 4: Verify the web UI**

Open `http://<MAC_MINI_HOST>:8265/` from any LAN browser. Expected: Tdarr UI loads.

- [ ] **Step 5: Verify the SMB share is visible inside the container**

```bash
docker exec tdarr-server ls /media
```
Expected: `_failed`, `_staging`, `movies`, `tv`.

If empty, the bind mount of `/Volumes/media` did not propagate into Colima — recreate Colima with `--mount-type virtiofs` and re-`docker compose up -d`.

- [ ] **Step 6: Add the libraries in the Tdarr UI**

In the Tdarr web UI:
- **Library** → **Add Library** → name `Movies`, source `/media/movies`, output transcode cache `/temp`.
- **Library** → **Add Library** → name `TV`, source `/media/tv`, output transcode cache `/temp`.
- Leave the **Transcode** queue size at default; cap CPU workers at **0** (we use VideoToolbox-capable nodes only).

- [ ] **Step 7: Log it**

```
phase2: tdarr-server up at http://<MAC_MINI_HOST>:8265 with /media bind mount
```

---

## Task 4: Install + run the Tdarr Node natively on Mac Mini M4

**Resource:** `tdarr-node` daemon connected to the local server, registered as worker `m4`

- [ ] **Step 1: Install ffmpeg + HandBrakeCLI**

```bash
brew install ffmpeg handbrake
which ffmpeg HandBrakeCLI
ffmpeg -hide_banner -encoders 2>&1 | grep videotoolbox
```

Expected: `hevc_videotoolbox` and `h264_videotoolbox` in the encoder list.

- [ ] **Step 2: Download the Tdarr Node arm64 macOS binary**

Visit https://tdarr.io/downloads.html and grab the latest `Tdarr_Node` zip for macOS arm64. Unzip into `~/tdarr-node`.

(Alternative: use Tdarr's `tdarr-update` script if you prefer auto-updates.)

```bash
cd ~/tdarr-node
chmod +x Tdarr_Node
```

- [ ] **Step 3: Configure the node**

Edit `~/tdarr-node/configs/Tdarr_Node_Config.json`:

```json
{
  "nodeID": "m4",
  "nodeIP": "0.0.0.0",
  "nodePort": 8267,
  "serverIP": "127.0.0.1",
  "serverPort": 8266,
  "handbrakePath": "/opt/homebrew/bin/HandBrakeCLI",
  "ffmpegPath": "/opt/homebrew/bin/ffmpeg",
  "mkvpropeditPath": "/opt/homebrew/bin/mkvpropedit",
  "pathTranslators": [
    { "server": "/media", "node": "/Volumes/media" }
  ]
}
```

`pathTranslators` is the critical piece — server sees `/media` (its bind mount), node sees `/Volumes/media` (its SMB mount).

- [ ] **Step 4: Smoke-start the node**

```bash
cd ~/tdarr-node
./Tdarr_Node
```

Expected: log lines showing "Connected to server" and the new worker `m4` appearing in the Tdarr web UI under **Tdarr Nodes**.

Stop with Ctrl-C once verified.

- [ ] **Step 5: Set up launchd auto-start**

`~/Library/LaunchAgents/com.tdarr.node.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.tdarr.node</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/<USER>/tdarr-node/Tdarr_Node</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/<USER>/tdarr-node</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/Users/<USER>/tdarr-node/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/<USER>/tdarr-node/stderr.log</string>
</dict>
</plist>
```

(Substitute `<USER>` with the macOS username.)

```bash
launchctl load -w ~/Library/LaunchAgents/com.tdarr.node.plist
launchctl list | grep tdarr
```
Expected: `com.tdarr.node` listed with PID > 0.

- [ ] **Step 6: Confirm node alive in UI**

The `m4` worker should be **online** in the Tdarr web UI's Nodes panel.

- [ ] **Step 7: Log it**

```
phase2: tdarr node m4 native on mac mini, launchd-managed
```

---

## Task 5: Install + run the Tdarr Node natively on MBP M1

Repeat Task 4 on the MBP M1 with **two differences**:

- `nodeID` becomes `m1`
- `serverIP` becomes the Mac Mini's LAN IP / hostname (not `127.0.0.1`)

- [ ] **Steps 1–7:** mirror Task 4 on the MBP. After Step 6 the Tdarr Nodes panel should show **two** workers — `m4` and `m1` — both online when the MBP is on the LAN.

- [ ] **Step 8: Verify the path translator works** by triggering a no-op job (use Tdarr's "Process file with workflow" on a small file already direct-play-ready; the worker should accept it without "file not found" errors).

---

## Task 6: Custom encode plugins

**Files:** Created via Tdarr UI or by dropping into `~/tdarr-server-data/server/Tdarr/Plugins/Local/`.

- [ ] **Step 1: Plugin — `Tdarr_Plugin_tpd_4k_hevc_directplay.js`**

Generates the 4K HEVC direct-play variant when the source is 4K and not already HEVC ≤ 25 Mbps + AAC.

```js
const details = () => ({
  id: 'Tdarr_Plugin_tpd_4k_hevc_directplay',
  Stage: 'Pre-processing',
  Name: 'TPD: 4K HEVC direct-play variant',
  Type: 'Video',
  Operation: 'Transcode',
  Description: 'Produce a 4K HEVC 10-bit direct-play variant with hvc1 tag and AAC stereo.',
  Version: '1.0.0',
  Tags: 'video only,hevc,videotoolbox,configurable',
  Inputs: [
    { name: 'bitrate_mbps', type: 'string', defaultValue: '25',
      inputUI: { type: 'text' }, tooltip: 'Target bitrate in Mbps.' },
  ],
});

const plugin = (file, librarySettings, inputs) => {
  const response = { processFile: false, preset: '', container: '.mkv', handBrakeMode: false,
                     FFmpegMode: true, reQueueAfter: false, infoLog: '' };
  if (file.fileMedium !== 'video') return response;
  const w = file.ffProbeData.streams[0].width || 0;
  if (w < 3000) { response.infoLog += 'not 4K, skipping'; return response; }

  const codec = file.ffProbeData.streams[0].codec_name;
  const bitDepth = (file.ffProbeData.streams[0].bits_per_raw_sample || '8');
  const bitrate = file.bit_rate ? Math.round(file.bit_rate / 1_000_000) : 0;
  const audioOk = file.ffProbeData.streams.some(s => s.codec_type === 'audio' && s.codec_name === 'aac');
  if (codec === 'hevc' && bitDepth === '10' && bitrate <= Number(inputs.bitrate_mbps) && audioOk) {
    response.infoLog += 'already direct-play; skipping';
    return response;
  }

  const filename = file._id.split('/').pop().replace(/\.[^.]+$/, '');
  const editionTag = ' {edition-4K HEVC Direct Play}';
  const outName = filename + editionTag + '.mkv';

  response.preset =
    `,-map 0:v -c:v hevc_videotoolbox -b:v ${inputs.bitrate_mbps}M -tag:v hvc1 -profile:v main10 ` +
    `-map 0:a -c:a copy ` +
    `-map 0:a:0 -c:a aac -ac 2 -b:a 192k ` +
    `-map 0:s? -c:s copy`;
  response.container = '.mkv';
  response.processFile = true;
  response.outputFileName = outName;
  response.infoLog += `producing 4K HEVC direct-play variant -> ${outName}`;
  return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
```

- [ ] **Step 2: Plugin — `Tdarr_Plugin_tpd_1080p_h264_sdr.js`**

Generates the 1080p H.264 SDR fallback variant. Tonemaps HDR sources.

```js
const details = () => ({
  id: 'Tdarr_Plugin_tpd_1080p_h264_sdr',
  Stage: 'Pre-processing',
  Name: 'TPD: 1080p H.264 SDR fallback variant',
  Type: 'Video',
  Operation: 'Transcode',
  Description: '1080p H.264 8-bit SDR fallback. HDR sources are tonemapped via zscale+hable.',
  Version: '1.0.0',
  Tags: 'video only,h264,videotoolbox,configurable',
  Inputs: [
    { name: 'bitrate_mbps', type: 'string', defaultValue: '8',
      inputUI: { type: 'text' }, tooltip: 'Target bitrate in Mbps.' },
    { name: 'tonemap', type: 'string', defaultValue: 'hable',
      inputUI: { type: 'dropdown', options: ['hable','mobius','reinhard'] }, tooltip: 'HDR tonemap algorithm.' },
  ],
});

const plugin = (file, librarySettings, inputs) => {
  const response = { processFile: false, preset: '', container: '.mkv', handBrakeMode: false,
                     FFmpegMode: true, reQueueAfter: false, infoLog: '' };
  if (file.fileMedium !== 'video') return response;
  const w = file.ffProbeData.streams[0].width || 0;
  const hasHdr = (file.ffProbeData.streams[0].color_transfer || '').includes('smpte2084')
              || (file.ffProbeData.streams[0].color_primaries || '').includes('bt2020');

  const filename = file._id.split('/').pop().replace(/\.[^.]+$/, '');
  const editionTag = ' {edition-1080p SDR}';
  const outName = filename + editionTag + '.mkv';
  const filter = hasHdr
    ? `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=${inputs.tonemap},zscale=t=bt709:m=bt709:r=tv,format=yuv420p,scale=1920:-2`
    : 'scale=1920:-2,format=yuv420p';

  response.preset =
    `,-map 0:v -vf "${filter}" -c:v h264_videotoolbox -b:v ${inputs.bitrate_mbps}M ` +
    `-profile:v high -level 4.1 ` +
    `-map 0:a:0 -c:a aac -ac 2 -b:a 192k ` +
    `-map 0:s? -c:s copy`;
  response.container = '.mkv';
  response.processFile = true;
  response.outputFileName = outName;
  response.infoLog += `producing 1080p SDR variant (hdr=${hasHdr}, w=${w}) -> ${outName}`;
  return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
```

- [ ] **Step 3: Drop both plugins into the Local plugins directory**

```bash
mkdir -p ~/tdarr-server-data/server/Tdarr/Plugins/Local
cp Tdarr_Plugin_tpd_4k_hevc_directplay.js ~/tdarr-server-data/server/Tdarr/Plugins/Local/
cp Tdarr_Plugin_tpd_1080p_h264_sdr.js   ~/tdarr-server-data/server/Tdarr/Plugins/Local/
docker exec tdarr-server ls /app/server/Tdarr/Plugins/Local
```

Expected: both files visible inside the container.

- [ ] **Step 4: Add the plugins to each library's transcode plugin stack**

In the Tdarr UI:
- **Movies → Plugins → Transcode → Add plugin → Local** → `TPD: 4K HEVC direct-play variant`. Set bitrate to `25`.
- Same library → **Add plugin** → `TPD: 1080p H.264 SDR fallback variant`. Set bitrate to `8`, tonemap `hable`.
- Repeat for **TV** library.

- [ ] **Step 5: Log it**

```
phase2: tdarr custom plugins installed (4k hevc directplay, 1080p sdr)
```

---

## Task 7: Fixtures

Validates the rules table from the spec end-to-end.

- [ ] **Step 1: Stage the five fixtures**

Place these files into `/Volumes/media/movies/_fixtures/` from the Mac Mini:

| Fixture filename | Source profile | Expected outputs |
|------------------|----------------|------------------|
| `fixture-1.mkv`  | 4K HEVC HDR10 + TrueHD/Atmos | both variants generated |
| `fixture-2.mkv`  | 4K H.264 8-bit SDR | both variants generated |
| `fixture-3.mkv`  | 1080p HEVC 10-bit | no 4K variant; 1080p variant skipped (already direct-play) |
| `fixture-4.mkv`  | corrupt MKV (truncate a real file with `head -c 1M`) | source quarantined to `_failed/` |
| `fixture-5/`     | TV show, 5 episodes 4K HDR | all 5 episodes get both variants |

- [ ] **Step 2: Trigger a library scan**

In the Tdarr UI, click **Scan** for the Movies library, then for TV. Watch the queue populate.

- [ ] **Step 3: Verify dispatch across nodes**

Once the queue has more than one item, both `m4` and `m1` workers should pick up jobs (assuming MBP is online). The Tdarr Nodes panel shows job titles per worker.

- [ ] **Step 4: Per-fixture acceptance**

For each fixture, after its job completes:

1. ffprobe each generated output:
   ```bash
   ffprobe -hide_banner "/Volumes/media/movies/<title>/<filename> {edition-4K HEVC Direct Play}.mkv"
   ```
   Expected: codec `hevc`, bit depth 10, hvc1 tag, audio `aac` (stereo) plus original audio track.
2. ffprobe the 1080p variant:
   Expected: codec `h264`, profile `high`, ~1920x... resolution, AAC stereo, no HDR metadata.
3. Plex direct-plays each variant on:
   - Apple TV 4K (tvOS Plex)
   - Samsung Tizen Plex
   - LG webOS Plex
   - iPhone, iPad, Mac Plex apps
4. Plex dashboard shows zero transcode sessions during playback for each variant.
5. fixture-3 produced no 4K variant (rules table says "skip" for already-1080p).
6. fixture-4 source ended up in `/Volumes/media/_failed/` — dashboard's Flow view should show it on the Failed Quarantine node.
7. fixture-5 dispatched parallel jobs across both nodes — visible as alternating M4/M1 assignments in the Tdarr UI and as concurrent activity on both nodes in the dashboard's Flow view.

- [ ] **Step 5: Sign-off + tag**

Append to ops log:
```
phase2: ACCEPTED — fixture pack passed, parallel m4/m1 dispatch verified, plex direct-plays everywhere
```

Tag the dashboard repo:
```bash
cd /Users/npalakurla/WorkingFolder/TranscodePipelineDash
git tag phase-2-complete
```

---

## Self-Review (Phase 2)

- **Spec coverage:** Tdarr Server, two Tdarr Nodes, encode rules (4K HEVC + 1080p SDR with HDR tonemap), per-node parallel dispatch, fixture pack including failure-case quarantine, Plex direct-play verification across all five client platforms. Complete.
- **Placeholder scan:** No "TBD"/"TODO". `<TRUENAS_HOST>`, `<MAC_MINI_HOST>`, `<USER>` are explicit user substitutions, captured at the points they're needed.
- **Type/name consistency:** `tdarr` SMB user from Phase 1; `m4` and `m1` node IDs flow into the dashboard's Kanban "Encoding @ M4 / @ M1" columns; `{edition-4K HEVC Direct Play}` and `{edition-1080p SDR}` filenames match the Plex multi-version naming locked in the spec.
- **Risks:**
  - Colima virtiofs bind mount can drop on macOS sleep → add a script that runs `colima stop && colima start` if `docker exec tdarr-server ls /media` fails. Consider adding a healthcheck to the `compose.yml` later.
  - Native Tdarr Node binary updates aren't auto-managed; once a quarter, manually `tdarr-update` the binaries.
  - VideoToolbox quality at 25 Mbps HEVC is "acceptable for most content"; very dark or grainy films may show banding. Per-title bitrate override via Tdarr is the escape hatch.
  - `pathTranslators` mismatch is the most common source of "file not found" errors. If a node logs that, double-check `/media` (server) vs `/Volumes/media` (node) are exactly the strings in the JSON.
