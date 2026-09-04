# Tournament Companion

Desktop application for running a tournament and driving a full-screen TV
display, whether it is beer pong, table football, football, darts or
something of your own. Tournament control, TV display and the SQLite database
live in one application built with Tauri and SvelteKit. No web server, no
cloud service, no network required.

The user interface is in German. This document is for developers.

## Setting up a tournament

On first start the home page leads to the settings page (`/admin/setup/`),
where the tournament is described. Presets for beer pong, table football,
football and darts prefill every field; every option stays editable.

| Area | Options |
| --- | --- |
| Appearance | Name, subtitle, sport, accent colour, custom logo |
| Format | Groups + knockout, groups only (league) or knockout only; number and size of groups; teams advancing per group; bracket size (2 to 32); third-place match; number and label of playing surfaces; participant wording; player names on/off |
| Scoring | Score unit (cups, goals, legs …), draws allowed, points per win/draw/loss, ordered tiebreakers (points, wins, difference, score for, head-to-head) |
| Timing | Match length in the group and knockout phase, break between time slots |
| TV display | Scale, safe-area margin, header on/off, calibration frame |

Format and sizes are locked once a schedule exists. Everything else can be
changed at any time, also during the event. To rebuild, reset the schedule
in the danger zone of the settings page.

The accent colour drives the whole interface: headers, buttons, tables and
the TV display. Light accents automatically get dark text.

## Prerequisites

- Node.js 20 or newer and pnpm
- Rust (stable) plus the system packages for Tauri 2, see
  <https://v2.tauri.app/start/prerequisites/>
- On Linux in particular `webkit2gtk` and `libayatana-appindicator`

## Development

```bash
pnpm install
pnpm tauri dev
```

On first start the application creates its database and applies all
migrations. There is no separate migrate or seed command.

An installable build:

```bash
pnpm tauri build
```

The packages end up in `src-tauri/target/release/bundle/`.

### Linux, Wayland and NVIDIA

WebKitGTK's DMA-BUF renderer crashes on Wayland with the NVIDIA driver
("Error 71 dispatching to Wayland display"). The binary therefore sets
`WEBKIT_DISABLE_DMABUF_RENDERER=1` at startup on Linux unless the variable is
already set (see `src-tauri/src/lib.rs`). This applies to `tauri dev` and to
the packaged app.

## Building installers on GitHub

The workflow in `.github/workflows/build.yml` builds installers for Windows
(x64, NSIS setup) and Linux (x64, AppImage and `.deb`):

- Push a tag such as `v0.2.0`: both installers are built and published as a
  GitHub release.
- "Run workflow" on the Actions page: both installers are built and stored as
  workflow artifacts, without a release.

Before the first release enable *Settings → Actions → General → Workflow
permissions → Read and write permissions*, otherwise the workflow cannot
create a release.

On a free GitHub account, builds in public repositories are free. Private
repositories get 2,000 minutes per month, with Windows minutes counting
double; one run takes roughly 10 to 15 minutes per platform.

The version comes from `src-tauri/tauri.conf.json` and should match the tag.

## Architecture

| Part | Location | Purpose |
| --- | --- | --- |
| UI | `src/routes` | Home page, tournament control, settings, TV display |
| Tournament logic | `src/lib/tournament` | Configuration, rules, standings, schedule generators |
| Database client | `src/lib/db/client.ts` | Calls the Rust commands |
| Database | `src-tauri/src/db.rs` | SQLite via rusqlite, migrations, transactions |
| Migrations | `src-tauri/migrations` | Schema definition |

The frontend is a pure single-page application (`adapter-static`, no SSR),
prerendered per route so the TV window can open `/display/` directly from the
bundled assets.

All writes go through the Rust command `db_batch`, which executes the
statements of one action in a single transaction. If any statement fails, the
whole action is rolled back. Rust holds exactly one database connection
behind a mutex, so two concurrent actions can never interleave. A statement
in a batch may reference the row id inserted by an earlier statement via
`{ "$lastInsertId": <index> }`, which is how rounds and their matches are
created atomically.

Tournament configuration is stored as one JSON document in the
`tournament_settings.config` column and validated by `normalizeConfig()` in
`src/lib/tournament/config.ts`. Unknown fields are dropped and missing ones
filled from the defaults, so stored configs stay readable when options are
added.

### Modules in `src/lib/tournament`

| File | Content |
| --- | --- |
| `config.ts` | `TournamentConfig` type, defaults, presets, validation, phase names, brand palette |
| `standings.ts` | Pure standings calculation with configurable points and tiebreakers |
| `service.ts` | All actions: teams, groups, rounds, matches, results, generators, config |
| `api.ts` | Action dispatcher used by the pages; serialises mutations |
| `seed.ts` | Example tournament matching the current configuration |
| `theme.ts` | Applies accent colour and contrast colour to the document |

### Schedule generators

The group phase uses the circle method for round robin within each group and
packs the fixtures into time slots: at most one match per playing surface per
slot, and no team twice in the same slot. Every slot becomes a round with its
own timer.

The knockout bracket seeds by finishing position first, then by group, so
group winners avoid each other early. Bracket size must be a power of two
between 2 and 32; byes are not supported. Rounds are named automatically
(round of 16, quarterfinal, …) and split across several time slots when a
round has more matches than playing surfaces. Matches are inserted from the
final backwards so each one can reference its successor.

## Two windows for laptop and TV

Tournament control and the TV display run in separate windows of the same
application. The display is opened from the header of the control page or
from the home page, moved to the TV and switched to full screen with `F11`.
On the TV itself `+`/`-` change the scale, `0` resets it, `G` toggles the
calibration frame and `H` the header.

The display has no navigation, no forms and no scrollbars. It reloads its
data every 1.5 seconds, the control page every 3 seconds. Both windows read
the same database and therefore always show the same state.

## Database

The database lives in the application's data directory:

| System | Path |
| --- | --- |
| Linux | `~/.local/share/de.niclaskuhn.tournament-companion/tournament.db` |
| Windows | `%APPDATA%\de.niclaskuhn.tournament-companion\tournament.db` |
| macOS | `~/Library/Application Support/de.niclaskuhn.tournament-companion/tournament.db` |

SQLite runs in WAL mode with a busy timeout and foreign keys enabled.
Migrations are compiled into the application and applied once at startup;
applied migrations are recorded in the `_migrations` table.

The project is pre-release: the schema is a single `0000_initial.sql` and is
edited in place rather than migrated. Once released, add further `.sql` files
to `src-tauri/migrations` and list them in `MIGRATIONS` in
`src-tauri/src/db.rs`.

### Backup

Close the application and copy the SQLite files:

```powershell
New-Item -ItemType Directory -Force backup
Copy-Item $env:APPDATA\de.niclaskuhn.tournament-companion\tournament.db* backup\
```

On Linux and macOS:

```bash
mkdir -p backup
cp ~/.local/share/de.niclaskuhn.tournament-companion/tournament.db* backup/
```

To restore, close the application and copy the files back.

## Behaviour and rules

- A round start sets all its scheduled matches to `running`. The timer stores
  an absolute end time, so reloads and a briefly closed display window do not
  change the remaining time. Pausing stores the remaining seconds; resuming
  computes a new end time.
- Standings are never stored; they are computed from finished matches on
  every read, following the configured points and tiebreaker order. Changing
  the scoring settings affects all tables immediately.
- Draws are only possible in the group phase and only when enabled. Knockout
  matches can never end in a draw.
- The winner of a knockout match is written into the configured slot of the
  next match (`nextMatchId`/`nextMatchSlot`); semifinal losers go to the
  third-place match.
- Teams of a match must differ, and a team can be scheduled only once per
  round. Group size and participant count follow the configuration.
- Destructive actions (delete, reset, seed) require confirmation in the UI.

The control page contains a full user manual (in German) under the "Hilfe"
tab.

## Quality checks

```bash
pnpm run check
pnpm run build
cargo check --manifest-path src-tauri/Cargo.toml
```
