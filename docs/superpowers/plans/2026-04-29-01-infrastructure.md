# Phase 1 — Infrastructure (Storage + Plex VM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up TrueNAS dataset layout, SMB share with a dedicated `tdarr` user, and an Ubuntu LTS VM running Plex Media Server that mounts the library via virtiofs.

**Architecture:** ZFS datasets organize media (`/movies`, `/tv`) and pipeline working dirs (`/_staging`, `/_failed`). An Incus-managed Ubuntu VM on SCALE Electric Eel mounts the parent dataset via virtiofs and runs Plex from the official `.deb` APT repo. SMB exports the same dataset for the Mac Tdarr workers (Phase 2 consumers).

**Tech Stack:** TrueNAS SCALE 24.10+ (Electric Eel, Incus-based Instances), ZFS, SMB (`smbd`), Ubuntu Server 24.04 LTS, Plex Media Server `.deb` from `downloads.plex.tv`.

**Source spec:** [docs/superpowers/specs/2026-04-29-truenas-plex-transcode-pipeline-design.md](../specs/2026-04-29-truenas-plex-transcode-pipeline-design.md)

**Parent plan:** [2026-04-29-truenas-plex-transcode-pipeline.md](./2026-04-29-truenas-plex-transcode-pipeline.md)

---

## File / Resource Structure

This phase creates infrastructure resources, not code files. Resources created:

| Resource | Type | Owner / Path |
|----------|------|--------------|
| `tank/media` | ZFS dataset (parent) | TrueNAS pool |
| `tank/media/movies`, `tank/media/tv`, `tank/media/_staging`, `tank/media/_failed` | ZFS datasets (children) | TrueNAS pool |
| `tdarr` | Local user (SMB-only) | TrueNAS Credentials |
| `media` | SMB share | TrueNAS Sharing |
| `plex-vm` | Incus VM | TrueNAS Instances |
| `/media` (inside VM) | virtiofs mount | Ubuntu VM |
| `plex` user | System user inside VM | Ubuntu VM (created by `.deb`) |

Configuration files modified inside the Ubuntu VM:

- Create: `/etc/apt/sources.list.d/plexmediaserver.list`
- Create: `/etc/fstab` entry for virtiofs
- Modify (review): `/etc/sysctl.conf` (raise `vm.swappiness` only if scan thrashes — verified, not pre-applied)

Nothing in this phase touches the Mac workers. Those land in Phase 2.

---

## Task 1: Create ZFS Datasets

**Resource:**
- Create: `tank/media` and four children (`movies`, `tv`, `_staging`, `_failed`)

- [ ] **Step 1: SSH into TrueNAS and confirm pool name**

Run on TrueNAS host:
```bash
zfs list -d 0 -o name,used,available -t filesystem
```

Expected: a line listing the pool (commonly `tank`). If it is named differently (e.g., `pool0`), substitute that name everywhere below. Record the actual name.

- [ ] **Step 2: Create the parent dataset**

Run on TrueNAS host (replace `tank` with your pool name if different):
```bash
zfs create -o compression=lz4 -o atime=off tank/media
```

Verify:
```bash
zfs get -H -o value mountpoint tank/media
```
Expected: `/mnt/tank/media`

- [ ] **Step 3: Create the four child datasets**

```bash
zfs create tank/media/movies
zfs create tank/media/tv
zfs create tank/media/_staging
zfs create tank/media/_failed
```

Verify:
```bash
ls -1 /mnt/tank/media
```
Expected (exact, four lines):
```
_failed
_staging
movies
tv
```

- [ ] **Step 4: Take a baseline snapshot**

```bash
zfs snapshot -r tank/media@phase1-baseline
zfs list -t snapshot tank/media@phase1-baseline
```

Expected: one `phase1-baseline` row per dataset (5 rows total, parent + 4 children with `-r` recursive).

- [ ] **Step 5: Commit infrastructure note**

Append a one-line note to your operations log (`docs/ops-log.md` — create if missing) recording the pool name and snapshot timestamp.

```bash
mkdir -p docs && \
  echo "$(date -Iseconds)  phase1: created tank/media datasets, snapshot phase1-baseline" >> docs/ops-log.md && \
  git add docs/ops-log.md && \
  git commit -m "ops: log creation of media datasets + phase1-baseline snapshot"
```

---

## Task 2: Create Dedicated `tdarr` SMB User

**Resource:**
- Create: local user `tdarr` (no home dir, SMB-only, no shell access)

- [ ] **Step 1: Generate a strong password and store it in your password manager**

Use your password manager. The plan does not embed it. Refer to it as `<TDARR_PW>` below.

- [ ] **Step 2: Create the user via TrueNAS UI**

Navigate: **Credentials → Local Users → Add**.

Fields:
- Full Name: `Tdarr Encoder`
- Username: `tdarr`
- Password: `<TDARR_PW>`
- Disable Password: **off**
- Shell: `nologin`
- Home Directory: `/var/empty`
- Create Home Directory: **off**
- Auxiliary Groups: `builtin_users` (default)
- Samba Authentication: **on**

Save.

- [ ] **Step 3: Verify the user exists and is SMB-enabled**

Run on TrueNAS host:
```bash
midclt call user.query '[["username","=","tdarr"]]' | jq '.[0] | {username, smb, shell}'
```

Expected (smb true, shell `/usr/sbin/nologin`):
```json
{
  "username": "tdarr",
  "smb": true,
  "shell": "/usr/sbin/nologin"
}
```

- [ ] **Step 4: Grant `tdarr` ownership of the media datasets**

```bash
chown -R tdarr:builtin_users /mnt/tank/media
chmod -R u=rwX,g=rwX,o= /mnt/tank/media
```

Verify:
```bash
stat -c '%U %G %a' /mnt/tank/media
```
Expected: `tdarr builtin_users 770`

- [ ] **Step 5: Commit ops note**

```bash
echo "$(date -Iseconds)  phase1: created tdarr SMB user, chowned tank/media to tdarr:builtin_users 770" >> docs/ops-log.md
git add docs/ops-log.md
git commit -m "ops: log tdarr user creation and dataset ownership"
```

---

## Task 3: Export `tank/media` as SMB Share

**Resource:**
- Create: SMB share named `media`

- [ ] **Step 1: Create the share via TrueNAS UI**

Navigate: **Shares → SMB → Add**.

Fields:
- Path: `/mnt/tank/media`
- Name: `media`
- Purpose: **Default share parameters**
- Description: `Pipeline media root — Tdarr workers mount this`
- Enabled: **on**

Save and accept the default ACL configuration when prompted.

- [ ] **Step 2: Confirm the share is exported**

Run on TrueNAS host:
```bash
midclt call sharing.smb.query '[["name","=","media"]]' | jq '.[0] | {name, path, enabled, locked}'
```

Expected:
```json
{
  "name": "media",
  "path": "/mnt/tank/media",
  "enabled": true,
  "locked": false
}
```

- [ ] **Step 3: Verify SMB service is running**

```bash
systemctl is-active smbd
```
Expected: `active`

If `inactive`: navigate **System → Services**, toggle SMB on, set "Start Automatically".

- [ ] **Step 4: Smoke-test the share from another machine**

From your Mac Mini (still preparing for Phase 2, but useful smoke test):
```bash
mkdir -p /tmp/media-smoke
mount_smbfs //tdarr@<TRUENAS_HOST>/media /tmp/media-smoke
ls -la /tmp/media-smoke
```

Expected: a directory listing showing `_failed`, `_staging`, `movies`, `tv`. You will be prompted for `<TDARR_PW>`.

Cleanup the smoke mount:
```bash
umount /tmp/media-smoke
rmdir /tmp/media-smoke
```

- [ ] **Step 5: Commit ops note**

```bash
echo "$(date -Iseconds)  phase1: SMB share 'media' exported at /mnt/tank/media, smoke-mounted from Mac Mini" >> docs/ops-log.md
git add docs/ops-log.md
git commit -m "ops: log SMB share export and smoke test"
```

---

## Task 4: Provision the Plex VM (Incus Instance)

**Resource:**
- Create: Incus VM named `plex-vm`, Ubuntu 24.04 LTS image, 2 vCPU, 4 GB RAM, 40 GB disk

- [ ] **Step 1: Confirm SCALE has Instances enabled**

Navigate: **Virtualization** (Incus-backed in 24.10+). If prompted to choose a storage pool for instances on first use, pick the same pool (`tank`) and accept defaults.

- [ ] **Step 2: Launch a new VM via UI**

Click **Create → Virtual Machine**.

Fields:
- Name: `plex-vm`
- Image: `ubuntu/24.04` (browse the official image catalog)
- Type: **Container** vs **Virtual Machine** → choose **Virtual Machine** (kernel isolation needed for virtiofs cleanly)
- CPU: `2`
- Memory: `4096` (MiB)
- Disk: `40` (GiB), pool: `tank`
- Network: bridge to host LAN (default), enable DHCP
- Auto-start: **on**

Click **Create**. Wait until status reads `Running`.

- [ ] **Step 3: Capture the VM's LAN IP**

After boot completes, on TrueNAS host:
```bash
incus list plex-vm --format=json | jq '.[0].state.network.eth0.addresses[] | select(.family=="inet") | .address'
```

Expected: a single IPv4 string (e.g. `"192.168.1.42"`). Record it as `<PLEX_VM_IP>`.

If the address rotates on DHCP, set a DHCP reservation for the VM's MAC on your router, or assign a static lease via `incus config device override plex-vm eth0 ipv4.address=<PLEX_VM_IP>`.

- [ ] **Step 4: Get a shell into the VM**

```bash
incus exec plex-vm -- bash
```

Inside the VM, set a non-root user with sudo (Ubuntu cloud images typically include `ubuntu`; verify or create):
```bash
id ubuntu || useradd -m -s /bin/bash -G sudo ubuntu
passwd ubuntu   # set a password for emergency console access
```

Exit back to the TrueNAS host:
```bash
exit
```

- [ ] **Step 5: Update the VM**

```bash
incus exec plex-vm -- apt-get update
incus exec plex-vm -- apt-get -y upgrade
```

Expected: clean exit codes for both.

- [ ] **Step 6: Commit ops note**

```bash
echo "$(date -Iseconds)  phase1: created plex-vm (ubuntu/24.04, 2 vCPU/4GB/40GB), IP <PLEX_VM_IP>" >> docs/ops-log.md
git add docs/ops-log.md
git commit -m "ops: log plex-vm provisioning"
```

---

## Task 5: Mount `tank/media` Into the Plex VM via virtiofs

**Resource:**
- Modify (Incus config): add a `disk` device of type `disk` with `source=/mnt/tank/media` to `plex-vm`
- Create (in VM): `/media` mount point and `/etc/fstab` entry

- [ ] **Step 1: Add the virtiofs disk device**

Run on TrueNAS host:
```bash
incus config device add plex-vm media-share disk \
  source=/mnt/tank/media \
  path=/media \
  shift=true
```

Verify:
```bash
incus config device show plex-vm | grep -A4 media-share
```
Expected output includes:
```
media-share:
  path: /media
  shift: "true"
  source: /mnt/tank/media
  type: disk
```

- [ ] **Step 2: Restart the VM so virtiofs binds**

```bash
incus restart plex-vm
incus list plex-vm
```

Wait until `STATE` shows `RUNNING` again.

- [ ] **Step 3: Verify the mount inside the VM**

```bash
incus exec plex-vm -- ls -la /media
```

Expected: same four entries (`_failed`, `_staging`, `movies`, `tv`).

If the directory is empty, virtiofs failed to bind — re-run Step 1 ensuring `shift=true` so UID mapping works, then restart.

- [ ] **Step 4: Confirm read-write from inside the VM**

```bash
incus exec plex-vm -- bash -c 'echo hello > /media/_staging/.virtiofs-test && cat /media/_staging/.virtiofs-test && rm /media/_staging/.virtiofs-test'
```

Expected: `hello` printed, then file removed without error.

- [ ] **Step 5: Commit ops note**

```bash
echo "$(date -Iseconds)  phase1: virtiofs /media mounted in plex-vm, RW verified" >> docs/ops-log.md
git add docs/ops-log.md
git commit -m "ops: log virtiofs mount in plex-vm"
```

---

## Task 6: Install Plex Media Server From the Official APT Repo

**Resource:**
- Create (in VM): `/etc/apt/sources.list.d/plexmediaserver.list`
- Install (in VM): `plexmediaserver` package
- Configure: Plex service enabled and running

- [ ] **Step 1: Get a shell into the VM**

```bash
incus exec plex-vm -- bash
```

All steps below run inside the VM until noted.

- [ ] **Step 2: Add Plex's signing key**

```bash
apt-get install -y curl gnupg apt-transport-https
curl -fsSL https://downloads.plex.tv/plex-keys/PlexSign.key | gpg --dearmor -o /usr/share/keyrings/plex.gpg
```

Verify:
```bash
ls -l /usr/share/keyrings/plex.gpg
```
Expected: file exists, non-empty, owned by root.

- [ ] **Step 3: Register the Plex APT repo**

```bash
echo "deb [signed-by=/usr/share/keyrings/plex.gpg] https://downloads.plex.tv/repo/deb public main" \
  > /etc/apt/sources.list.d/plexmediaserver.list
apt-get update
```

Expected: `apt-get update` lists `downloads.plex.tv` among sources and exits cleanly.

- [ ] **Step 4: Install the package**

```bash
DEBIAN_FRONTEND=noninteractive apt-get install -y plexmediaserver
```

Expected: a `plex` system user is created and the `plexmediaserver` service starts.

Verify:
```bash
systemctl is-enabled plexmediaserver
systemctl is-active plexmediaserver
id plex
```
Expected:
```
enabled
active
uid=NNN(plex) gid=NNN(plex) groups=NNN(plex)
```

- [ ] **Step 5: Allow `plex` to read `/media`**

Because virtiofs uses ID-shifting (`shift=true`), files appear owned by a mapped UID. Add `plex` to the group that owns the mount and verify read access:

```bash
PLEX_OWNER_GROUP=$(stat -c '%G' /media)
echo "Mount group: $PLEX_OWNER_GROUP"
usermod -aG "$PLEX_OWNER_GROUP" plex
systemctl restart plexmediaserver
sudo -u plex ls /media | head
```

Expected: `plex` can list the four child directories. If permission is denied, the mount group did not propagate — re-check `shift=true` in Task 5 Step 1.

- [ ] **Step 6: Exit the VM and verify Plex web UI is reachable**

```bash
exit
```

On any LAN machine, open `http://<PLEX_VM_IP>:32400/web` in a browser. Expected: the Plex setup wizard loads.

- [ ] **Step 7: Commit ops note**

On TrueNAS host:
```bash
echo "$(date -Iseconds)  phase1: plexmediaserver installed in plex-vm, web reachable at http://<PLEX_VM_IP>:32400/web" >> docs/ops-log.md
git add docs/ops-log.md
git commit -m "ops: log plex install and web reachability"
```

---

## Task 7: Configure Plex Libraries

**Resource:**
- Configure (Plex web UI): two libraries pointing to `/media/movies` and `/media/tv`

- [ ] **Step 1: Sign in to Plex**

In the Plex setup wizard:
- Sign in with the Plex account that will own this server.
- Server name: `Home Plex` (or your preference).
- Allow access outside the home network: **off** (LAN-only for now; revisit later if Tailscale or relay desired).
- Click through to the library setup screen.

- [ ] **Step 2: Add the Movies library**

Click **Add Library**:
- Type: **Movies**
- Name: `Movies`
- Folder: browse to `/media/movies`. Confirm Plex shows the path.
- Advanced → Scanner: **Plex Movie**
- Advanced → Agent: **Plex Movie**
- Advanced → Use local assets: **on** (so Plex picks up `{edition-...}` filenames produced in Phase 2)

Save.

- [ ] **Step 3: Add the TV library**

Click **Add Library**:
- Type: **TV Shows**
- Name: `TV`
- Folder: `/media/tv`
- Advanced → Scanner: **Plex TV Series**
- Advanced → Agent: **Plex TV Series**
- Advanced → Use local assets: **on**

Save.

- [ ] **Step 4: Wait for the initial scan**

Watch **Settings → Manage → Libraries** until both libraries report a non-zero item count (or zero if the directories are empty — that's also valid for now).

Expected: no scan errors. If errors mention permissions, repeat Task 6 Step 5 to fix group membership.

- [ ] **Step 5: Smoke-test direct-play on a sample 1080p file**

Place one small, known-good 1080p MP4 (H.264 + AAC) into `/mnt/tank/media/movies/Sample/Sample.mp4` from your TrueNAS host:

```bash
mkdir -p "/mnt/tank/media/movies/Sample (2024)"
# copy any 1080p H.264+AAC mp4 you own into the folder
```

Trigger a Plex library scan in the UI (`Movies → ⋯ → Scan Library Files`).

From an Apple TV / iPad / Mac on the same LAN, open Plex, locate the file, press play. Open **Server → Status → Now Playing**. Expected: the playback row shows **Direct Play** (no transcoder activity).

If it shows **Transcode**, the file is not actually H.264+AAC; pick a different sample. Direct-play of a known-compatible file is the prerequisite gate before Phase 2.

- [ ] **Step 6: Commit ops note**

On TrueNAS host:
```bash
echo "$(date -Iseconds)  phase1: Plex libraries Movies + TV configured, direct-play of sample mp4 verified" >> docs/ops-log.md
git add docs/ops-log.md
git commit -m "ops: log plex library setup and direct-play smoke test"
```

---

## Task 8: Phase 1 Sign-Off

- [ ] **Step 1: Run the Phase 1 acceptance checklist**

Confirm all of the following observably true. Do not check the box until each item passes:

1. `zfs list tank/media` shows parent + 4 children.
2. `zfs list -t snapshot tank/media@phase1-baseline` lists the recursive baseline.
3. `midclt call user.query '[["username","=","tdarr"]]'` returns `smb: true`.
4. `midclt call sharing.smb.query '[["name","=","media"]]'` returns `enabled: true`.
5. From a Mac on the LAN: `mount_smbfs //tdarr@<TRUENAS_HOST>/media /tmp/media-smoke && ls /tmp/media-smoke && umount /tmp/media-smoke` succeeds.
6. `incus list plex-vm` shows `RUNNING` and a stable IPv4.
7. Inside `plex-vm`: `ls /media` shows the four child directories and `sudo -u plex ls /media` succeeds.
8. `http://<PLEX_VM_IP>:32400/web` loads the Plex UI.
9. Plex shows the `Movies` and `TV` libraries with no scan errors.
10. A sample 1080p file plays as **Direct Play** (no transcode) on at least one client (Apple TV, iPad, or Mac).

- [ ] **Step 2: Tag the snapshot**

```bash
zfs snapshot -r tank/media@phase1-complete
```

- [ ] **Step 3: Final commit**

```bash
echo "$(date -Iseconds)  phase1: ACCEPTED — checklist passed, snapshot phase1-complete taken" >> docs/ops-log.md
git add docs/ops-log.md
git commit -m "ops: phase 1 accepted, infrastructure ready for tdarr workers"
```

Phase 1 done. Phase 2 (Tdarr server, nodes, plugins, fixtures) can now be planned against the real, running Plex VM and the SMB share.

---

## Self-Review (Phase 1)

- **Spec coverage:** Architecture diagram's TrueNAS dataset layout, SMB-with-tdarr-user, and Plex VM components are implemented in Tasks 1–7. Task 8 is acceptance gating. Encode pipeline, dashboard, and digest are out of scope per the parent plan and intentionally deferred.
- **Placeholder scan:** No "TBD"/"TODO". `<TDARR_PW>`, `<TRUENAS_HOST>`, and `<PLEX_VM_IP>` are explicit user-supplied substitutions, not placeholders for the engineer to invent — each is captured exactly once at the moment it is needed.
- **Type / name consistency:** `tank/media` and `/mnt/tank/media` and `/media` (in-VM) are used consistently. `tdarr` SMB user, `media` SMB share, `plex-vm` Incus VM, `media-share` device name — all stable across tasks. No drift.
- **Risks:**
  - If the user's pool is not `tank`, every command needs substitution. Task 1 Step 1 forces them to record the actual name.
  - If SCALE is older than 24.10 (no Incus Instances), Task 4 paths differ. The plan assumes Electric Eel or newer per the parent prerequisites.
  - virtiofs `shift=true` is required for UID mapping; without it Plex cannot read `/media`. Task 5 Step 4 catches this; Task 6 Step 5 catches it again.
  - Plex direct-play smoke test in Task 7 Step 5 requires a known H.264+AAC file. If the user only has HEVC sources, they should grab any small public-domain MP4 sample for the test.
