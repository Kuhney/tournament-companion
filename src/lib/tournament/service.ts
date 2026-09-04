import {
  batch,
  count,
  lastInsertId,
  run,
  selectAll,
  selectOne,
  type BatchStatement,
  type Param,
} from "$lib/db/client";
import type {
  DisplayMode,
  Group,
  Match,
  Phase,
  Settings,
  Team,
  TournamentRound,
  TournamentState,
} from "$lib/types/tournament";
import {
  bracketPhases,
  DISPLAY_FIELDS,
  knockoutTeamCount,
  maxTeams,
  normalizeConfig,
  PHASE_LABELS,
  STRUCTURAL_FIELDS,
  usesGroups,
  usesKnockout,
  type TournamentConfig,
} from "./config";
import { calculateStandings } from "./standings";

/** A round exactly as stored, before the remaining time is resolved. */
type RoundRow = Omit<TournamentRound, "remainingSeconds"> & {
  remainingSeconds: number | null;
};
/** A match exactly as stored, without the joined team and group objects. */
export type MatchRow = Omit<Match, "teamA" | "teamB" | "group">;
type SettingsRow = Settings & { config: string };

const nowIso = () => new Date().toISOString();
const asInt = (value: unknown, field: string, min = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min)
    throw new Error(`${field} ist ungültig.`);
  return parsed;
};
const asOptionalInt = (value: unknown, field: string) =>
  value === null || value === undefined || value === ""
    ? null
    : asInt(value, field);
const clean = (value: unknown, field: string) => {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} darf nicht leer sein.`);
  return text;
};
const optionalText = (value: unknown) => String(value ?? "").trim() || null;
const requiredDate = (value: unknown, field: string) => {
  const timestamp = Date.parse(clean(value, field));
  if (Number.isNaN(timestamp)) throw new Error(`${field} ist ungültig.`);
  return new Date(timestamp).toISOString();
};
const minutesInput = (value: unknown, fallback: number, field: string) =>
  value === undefined || value === null || value === ""
    ? fallback * 60
    : asInt(value, field, 1) * 60;

/**
 * Accepts either a full date or a plain `HH:MM` time. A plain time is placed on
 * the day of the tournament, taken from `reference` or from the earliest round.
 */
async function timeOnTournamentDate(
  value: unknown,
  field: string,
  reference?: string | null,
) {
  const text = clean(value, field);
  if (!/^\d{2}:\d{2}$/.test(text)) return requiredDate(text, field);
  const tournamentStart =
    reference ??
    (
      await selectOne<{ scheduledStart: string | null }>(
        "SELECT scheduled_start FROM rounds ORDER BY scheduled_start ASC LIMIT 1",
      )
    )?.scheduledStart;
  const date = tournamentStart ? new Date(tournamentStart) : new Date();
  const [hours, minutes] = text.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function resolvedRemaining(round: RoundRow, at = Date.now()) {
  if (round.status === "running" && round.endTime)
    return Math.max(0, Math.ceil((Date.parse(round.endTime) - at) / 1000));
  if (round.status === "paused")
    return Math.max(0, round.remainingSeconds ?? round.durationSeconds);
  if (round.status === "finished") return 0;
  return round.durationSeconds;
}

// ---------------------------------------------------------------------------
// Settings and configuration
// ---------------------------------------------------------------------------

async function ensureSettings(): Promise<SettingsRow> {
  let settings = await selectOne<SettingsRow>(
    "SELECT * FROM tournament_settings WHERE id = 1",
  );
  if (!settings) {
    await run("INSERT INTO tournament_settings (id) VALUES (1)");
    settings = (await selectOne<SettingsRow>(
      "SELECT * FROM tournament_settings WHERE id = 1",
    ))!;
  }
  return settings;
}

function parseConfig(json: string): TournamentConfig {
  try {
    return normalizeConfig(JSON.parse(json || "{}"));
  } catch {
    return normalizeConfig({});
  }
}

export async function loadConfig(): Promise<TournamentConfig> {
  return parseConfig((await ensureSettings()).config);
}

const asAsciiGroupName = (index: number) =>
  `Gruppe ${String.fromCharCode(65 + (index % 26))}${index >= 26 ? Math.floor(index / 26) : ""}`;

export async function updateConfig(input: Record<string, unknown>) {
  const next = normalizeConfig(input.config);
  next.setupDone = true;
  const current = await loadConfig();
  const roundCount = await count("SELECT COUNT(*) FROM rounds");
  if (roundCount > 0) {
    const changed = STRUCTURAL_FIELDS.filter(
      (field) => current[field] !== next[field],
    );
    if (changed.length)
      throw new Error(
        "Format und Größen lassen sich nicht mehr ändern, solange ein Spielplan existiert. Zuerst den Spielplan zurücksetzen.",
      );
  }
  const statements: BatchStatement[] = [
    {
      sql: "UPDATE tournament_settings SET config = ? WHERE id = 1",
      params: [JSON.stringify(next)],
    },
  ];
  // A fresh tournament gets its groups created right away so the admin can
  // start adding teams without an extra step.
  if (usesGroups(next) && (await count("SELECT COUNT(*) FROM groups")) === 0)
    for (let index = 0; index < next.groupCount; index++)
      statements.push({
        sql: "INSERT INTO groups (name) VALUES (?)",
        params: [asAsciiGroupName(index)],
      });
  await batch(statements);
}

/**
 * Updates only the TV display options. Checkbox fields arrive as "on" from a
 * form or as booleans from a script; anything missing counts as unchecked.
 */
export async function updateDisplay(input: Record<string, unknown>) {
  const current = await loadConfig();
  const patch: Record<string, unknown> = { ...current };
  for (const field of DISPLAY_FIELDS)
    if (field in input || typeof current[field] === "boolean")
      patch[field] =
        typeof current[field] === "boolean"
          ? input[field] === true || input[field] === "on" || input[field] === "true"
          : input[field];
  const next = normalizeConfig(patch);
  await run("UPDATE tournament_settings SET config = ? WHERE id = 1", [
    JSON.stringify(next),
  ]);
}

/** Deletes the schedule or, with scope "all", the whole tournament. */
export async function resetTournament(input: Record<string, unknown>) {
  const scope = input.scope === "all" ? "all" : "schedule";
  const statements: BatchStatement[] = [
    { sql: "DELETE FROM matches" },
    { sql: "DELETE FROM rounds" },
    {
      sql: "UPDATE tournament_settings SET current_round_id = NULL, current_phase = 'group' WHERE id = 1",
    },
  ];
  if (scope === "all")
    statements.push({ sql: "DELETE FROM teams" }, { sql: "DELETE FROM groups" });
  await batch(statements);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export async function getState(): Promise<TournamentState> {
  const settingsRow = await ensureSettings();
  const config = parseConfig(settingsRow.config);
  const { config: _json, ...settings } = settingsRow;
  const groupRows = await selectAll<Group>(
    "SELECT * FROM groups ORDER BY name ASC",
  );
  const teamRows = await selectAll<Team>("SELECT * FROM teams ORDER BY name ASC");
  const roundRows = await selectAll<RoundRow>(
    "SELECT * FROM rounds ORDER BY scheduled_start ASC, round_number ASC",
  );
  const matchRows = await selectAll<MatchRow>(
    "SELECT * FROM matches ORDER BY scheduled_at ASC, table_number ASC",
  );
  const enriched = matchRows.map((match) => ({
    ...match,
    teamA: teamRows.find((team) => team.id === match.teamAId) ?? null,
    teamB: teamRows.find((team) => team.id === match.teamBId) ?? null,
    group: groupRows.find((group) => group.id === match.groupId) ?? null,
  })) as Match[];
  const standings = Object.fromEntries(
    groupRows.map((group) => [
      group.id,
      calculateStandings(
        config,
        teamRows.filter((team) => team.groupId === group.id),
        matchRows.filter((match) => match.groupId === group.id),
      ),
    ]),
  );
  const current =
    roundRows.find((round) => round.id === settings.currentRoundId) ??
    roundRows.find(
      (round) => round.status === "running" || round.status === "paused",
    ) ??
    null;
  const tournamentRounds = roundRows.map((round) => ({
    ...round,
    remainingSeconds: resolvedRemaining(round),
  })) as TournamentRound[];
  return {
    generatedAt: nowIso(),
    config,
    teams: teamRows,
    groups: groupRows,
    matches: enriched,
    rounds: tournamentRounds,
    settings,
    currentRound: current
      ? tournamentRounds.find((round) => round.id === current.id)!
      : null,
    standings,
    nextMatches: enriched
      .filter(
        (match) => match.status === "scheduled" && match.teamA && match.teamB,
      )
      .slice(0, 6),
    qualifiedTeams:
      config.format === "groupsKnockout"
        ? Object.values(standings).flatMap((rows) =>
            rows.slice(0, config.advancingPerGroup).map((row) => row.team),
          )
        : [],
  };
}

// ---------------------------------------------------------------------------
// Teams and groups
// ---------------------------------------------------------------------------

async function assertTeamsAvailable(
  roundId: number,
  teamAId: number,
  teamBId: number,
  ignoreId?: number,
) {
  if (teamAId === teamBId)
    throw new Error("Ein Team kann nicht gegen sich selbst spielen.");
  const conflicts = (
    await selectAll<{ id: number }>(
      `SELECT id FROM matches
       WHERE round_id = ?
         AND (team_a_id IN (?, ?) OR team_b_id IN (?, ?))`,
      [roundId, teamAId, teamBId, teamAId, teamBId],
    )
  ).filter((match) => match.id !== ignoreId);
  if (conflicts.length)
    throw new Error("Ein Team ist in dieser Runde bereits eingeplant.");
}

async function assertGroupCapacity(
  config: TournamentConfig,
  groupId: number | null,
  ignoreTeamId?: number,
) {
  if (groupId === null) return;
  const memberCount = (
    await selectAll<{ id: number }>("SELECT id FROM teams WHERE group_id = ?", [
      groupId,
    ])
  ).filter((team) => team.id !== ignoreTeamId).length;
  if (memberCount >= config.groupSize)
    throw new Error(
      `Eine Gruppe darf höchstens ${config.groupSize} ${config.participantLabelPlural} enthalten.`,
    );
}

const surfaceNumber = (config: TournamentConfig, value: unknown) => {
  const number = asInt(value, config.surfaceLabel, 1);
  if (number > config.surfaceCount)
    throw new Error(
      `Es gibt nur ${config.surfaceLabel} 1 bis ${config.surfaceCount}.`,
    );
  return number;
};

export async function createTeam(input: Record<string, unknown>) {
  const config = await loadConfig();
  if ((await count("SELECT COUNT(*) FROM teams")) >= maxTeams(config))
    throw new Error(
      `Das Turnier ist auf ${maxTeams(config)} ${config.participantLabelPlural} begrenzt.`,
    );
  const groupId = asOptionalInt(input.groupId, "Gruppe");
  await assertGroupCapacity(config, groupId);
  await run(
    `INSERT INTO teams (name, players, short_name, color, logo, group_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      clean(input.name, "Name"),
      String(input.players ?? "").trim(),
      optionalText(input.shortName),
      optionalText(input.color),
      optionalText(input.logo),
      groupId,
    ],
  );
}

export async function updateTeam(input: Record<string, unknown>) {
  const config = await loadConfig();
  const id = asInt(input.id, "Team-ID", 1);
  const groupId = asOptionalInt(input.groupId, "Gruppe");
  await assertGroupCapacity(config, groupId, id);
  await run(
    `UPDATE teams
     SET name = ?, players = ?, short_name = ?, color = ?, group_id = ?
     WHERE id = ?`,
    [
      clean(input.name, "Name"),
      String(input.players ?? "").trim(),
      optionalText(input.shortName),
      optionalText(input.color),
      groupId,
      id,
    ],
  );
}

export async function deleteTeam(input: Record<string, unknown>) {
  await run("DELETE FROM teams WHERE id = ?", [asInt(input.id, "Team-ID", 1)]);
}

export async function createGroup(input: Record<string, unknown>) {
  const config = await loadConfig();
  if (!usesGroups(config))
    throw new Error("Dieses Turnierformat hat keine Gruppen.");
  if ((await count("SELECT COUNT(*) FROM groups")) >= config.groupCount)
    throw new Error(`Das Turnier ist auf ${config.groupCount} Gruppen begrenzt.`);
  await run("INSERT INTO groups (name) VALUES (?)", [
    clean(input.name, "Gruppenname"),
  ]);
}

export async function updateGroup(input: Record<string, unknown>) {
  await run("UPDATE groups SET name = ? WHERE id = ?", [
    clean(input.name, "Gruppenname"),
    asInt(input.id, "Gruppen-ID", 1),
  ]);
}

export async function deleteGroup(input: Record<string, unknown>) {
  const id = asInt(input.id, "Gruppen-ID", 1);
  if ((await count("SELECT COUNT(*) FROM matches WHERE group_id = ?", [id])) > 0)
    throw new Error("Eine Gruppe mit Spielen kann nicht gelöscht werden.");
  await run("DELETE FROM groups WHERE id = ?", [id]);
}

export async function shuffleGroups() {
  const config = await loadConfig();
  const groupRows = await selectAll<Group>(
    "SELECT * FROM groups ORDER BY id ASC",
  );
  const teamRows = await selectAll<Team>("SELECT * FROM teams");
  if (!usesGroups(config) || !groupRows.length)
    throw new Error("Es gibt keine Gruppen zum Auslosen.");
  if (teamRows.length > groupRows.length * config.groupSize)
    throw new Error("Es gibt mehr Teams, als in die Gruppen passen.");
  if ((await count("SELECT COUNT(*) FROM rounds WHERE phase = 'group'")) > 0)
    throw new Error(
      "Gruppen können nach Erstellung des Spielplans nicht mehr neu ausgelost werden.",
    );

  const shuffled = [...teamRows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Deal the teams around the groups so they stay evenly filled.
  await batch(
    shuffled.map((team, index) => ({
      sql: "UPDATE teams SET group_id = ? WHERE id = ?",
      params: [groupRows[index % groupRows.length].id, team.id] as Param[],
    })),
  );
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export async function updateRound(input: Record<string, unknown>) {
  const id = asInt(input.id, "Runden-ID", 1);
  const round = await selectOne<RoundRow>("SELECT * FROM rounds WHERE id = ?", [
    id,
  ]);
  if (!round) throw new Error("Runde wurde nicht gefunden.");
  const scheduledStart = await timeOnTournamentDate(
    input.scheduledStart,
    "Startzeit",
    round.scheduledStart,
  );
  const durationSeconds =
    input.durationMinutes !== undefined
      ? asInt(input.durationMinutes, "Spieldauer", 1) * 60
      : asInt(input.durationSeconds ?? round.durationSeconds, "Dauer", 30);
  await batch([
    {
      sql: "UPDATE rounds SET scheduled_start = ?, duration_seconds = ? WHERE id = ?",
      params: [scheduledStart, durationSeconds, id],
    },
    {
      sql: "UPDATE matches SET scheduled_at = ? WHERE round_id = ?",
      params: [scheduledStart, id],
    },
  ]);
}

export async function createRound(input: Record<string, unknown>) {
  const roundNumber = asInt(input.roundNumber, "Rundennummer", 1);
  const phase = String(input.phase ?? "group") as Phase;
  if (!(phase in PHASE_LABELS)) throw new Error("Phase ist ungültig.");
  await run(
    `INSERT INTO rounds (round_number, phase, name, scheduled_start, duration_seconds)
     VALUES (?, ?, ?, ?, ?)`,
    [
      roundNumber,
      phase,
      String(input.name ?? "").trim() || `Runde ${roundNumber}`,
      await timeOnTournamentDate(input.scheduledStart, "Startzeit"),
      input.durationMinutes !== undefined
        ? asInt(input.durationMinutes, "Spieldauer", 1) * 60
        : asInt(input.durationSeconds ?? 600, "Dauer", 30),
    ],
  );
}

export async function deleteRound(input: Record<string, unknown>) {
  const id = asInt(input.id, "Runden-ID", 1);
  const round = await selectOne<RoundRow>("SELECT * FROM rounds WHERE id = ?", [
    id,
  ]);
  if (!round) throw new Error("Runde wurde nicht gefunden.");
  if (round.status === "running" || round.status === "paused")
    throw new Error(
      "Eine aktive oder pausierte Runde kann nicht gelöscht werden.",
    );
  await batch([
    {
      sql: `UPDATE matches SET next_match_id = NULL, next_match_slot = NULL
            WHERE next_match_id IN (SELECT id FROM matches WHERE round_id = ?)`,
      params: [id],
    },
    { sql: "DELETE FROM rounds WHERE id = ?", params: [id] },
  ]);
}

export async function controlRound(
  action: string,
  input: Record<string, unknown>,
) {
  const id = asInt(input.roundId, "Runde", 1);
  const round = await selectOne<RoundRow>("SELECT * FROM rounds WHERE id = ?", [
    id,
  ]);
  if (!round) throw new Error("Runde wurde nicht gefunden.");
  const now = Date.now();

  if (action === "start") {
    const activeRound = await selectOne<RoundRow>(
      "SELECT * FROM rounds WHERE status IN ('running', 'paused') LIMIT 1",
    );
    if (activeRound && activeRound.id !== id)
      throw new Error(
        `„${activeRound.name}“ läuft bereits. Beende diese Runde zuerst.`,
      );
    const duration = asInt(
      input.durationSeconds ?? round.durationSeconds,
      "Dauer",
      30,
    );
    // The absolute end time is stored, so reloads and a briefly closed display
    // window cannot change the remaining time.
    await batch([
      {
        sql: `UPDATE rounds
              SET status = 'running', started_at = ?, end_time = ?,
                  remaining_seconds = NULL, duration_seconds = ?
              WHERE id = ?`,
        params: [
          new Date(now).toISOString(),
          new Date(now + duration * 1000).toISOString(),
          duration,
          id,
        ],
      },
      {
        sql: "UPDATE matches SET status = 'running' WHERE round_id = ? AND status = 'scheduled'",
        params: [id],
      },
      {
        sql: "UPDATE tournament_settings SET current_round_id = ?, current_phase = ? WHERE id = 1",
        params: [id, round.phase],
      },
    ]);
  } else if (action === "pause") {
    if (round.status !== "running")
      throw new Error("Nur eine laufende Runde kann pausiert werden.");
    await run(
      `UPDATE rounds SET status = 'paused', remaining_seconds = ?, end_time = NULL
       WHERE id = ?`,
      [resolvedRemaining(round, now), id],
    );
  } else if (action === "resume") {
    if (round.status !== "paused")
      throw new Error("Die Runde ist nicht pausiert.");
    const remaining = resolvedRemaining(round, now);
    await run(
      `UPDATE rounds SET status = 'running', end_time = ?, remaining_seconds = NULL
       WHERE id = ?`,
      [new Date(now + remaining * 1000).toISOString(), id],
    );
  } else if (action === "adjust") {
    const delta =
      asInt(Math.abs(Number(input.seconds)), "Zeit") *
      (Number(input.seconds) < 0 ? -1 : 1);
    const remaining = Math.max(0, resolvedRemaining(round, now) + delta);
    await run(
      round.status === "running"
        ? "UPDATE rounds SET end_time = ? WHERE id = ?"
        : "UPDATE rounds SET remaining_seconds = ? WHERE id = ?",
      [
        round.status === "running"
          ? new Date(now + remaining * 1000).toISOString()
          : remaining,
        id,
      ],
    );
  } else if (action === "finish") {
    const unresolved = await count(
      "SELECT COUNT(*) FROM matches WHERE round_id = ? AND (score_a IS NULL OR score_b IS NULL)",
      [id],
    );
    if (unresolved > 0)
      throw new Error(
        "Vor dem Beenden müssen Ergebnisse für alle Spiele eingetragen sein.",
      );
    await batch([
      {
        sql: `UPDATE rounds SET status = 'finished', end_time = ?, remaining_seconds = 0
              WHERE id = ?`,
        params: [new Date(now).toISOString(), id],
      },
      {
        sql: "UPDATE tournament_settings SET current_round_id = NULL WHERE id = 1",
      },
    ]);
  } else if (action === "reset") {
    await batch([
      {
        sql: `UPDATE rounds
              SET status = 'scheduled', started_at = NULL, end_time = NULL,
                  remaining_seconds = NULL
              WHERE id = ?`,
        params: [id],
      },
      {
        sql: "UPDATE matches SET status = 'scheduled' WHERE round_id = ?",
        params: [id],
      },
      {
        sql: "UPDATE tournament_settings SET current_round_id = NULL WHERE id = 1",
      },
    ]);
  } else throw new Error("Unbekannte Rundenaktion.");
}

// ---------------------------------------------------------------------------
// Matches and results
// ---------------------------------------------------------------------------

export async function createMatch(input: Record<string, unknown>) {
  const config = await loadConfig();
  const roundId = asInt(input.roundId, "Runde", 1);
  const teamAId = asInt(input.teamAId, "Team A", 1);
  const teamBId = asInt(input.teamBId, "Team B", 1);
  const round = await selectOne<RoundRow>("SELECT * FROM rounds WHERE id = ?", [
    roundId,
  ]);
  if (!round) throw new Error("Runde wurde nicht gefunden.");
  const scheduledAt = await timeOnTournamentDate(
    input.scheduledAt,
    "Spielzeit",
    round.scheduledStart,
  );
  await assertTeamsAvailable(roundId, teamAId, teamBId);
  await run(
    `INSERT INTO matches
       (phase, group_id, round_id, round, table_number, scheduled_at, team_a_id, team_b_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      round.phase,
      asOptionalInt(input.groupId, "Gruppe"),
      roundId,
      round.roundNumber,
      surfaceNumber(config, input.tableNumber),
      scheduledAt,
      teamAId,
      teamBId,
    ],
  );
}

export async function updateMatch(input: Record<string, unknown>) {
  const config = await loadConfig();
  const id = asInt(input.id, "Spiel-ID", 1);
  const old = await selectOne<MatchRow>("SELECT * FROM matches WHERE id = ?", [
    id,
  ]);
  if (!old) throw new Error("Spiel wurde nicht gefunden.");
  const roundId = asInt(input.roundId ?? old.roundId, "Runde", 1);
  const teamAId = asInt(input.teamAId ?? old.teamAId, "Team A", 1);
  const teamBId = asInt(input.teamBId ?? old.teamBId, "Team B", 1);
  const scheduledAt = await timeOnTournamentDate(
    input.scheduledAt ?? old.scheduledAt,
    "Spielzeit",
    old.scheduledAt,
  );
  await assertTeamsAvailable(roundId, teamAId, teamBId, id);
  await run(
    `UPDATE matches
     SET round_id = ?, team_a_id = ?, team_b_id = ?, group_id = ?,
         table_number = ?, scheduled_at = ?
     WHERE id = ?`,
    [
      roundId,
      teamAId,
      teamBId,
      asOptionalInt(input.groupId ?? old.groupId, "Gruppe"),
      surfaceNumber(config, input.tableNumber ?? old.tableNumber),
      scheduledAt,
      id,
    ],
  );
}

export async function deleteMatch(input: Record<string, unknown>) {
  await run("DELETE FROM matches WHERE id = ?", [
    asInt(input.id, "Spiel-ID", 1),
  ]);
}

export async function saveResult(input: Record<string, unknown>) {
  const config = await loadConfig();
  const id = asInt(input.id, "Spiel-ID", 1);
  const scoreA = asInt(input.scoreA, `${config.scoreLabel} A`);
  const scoreB = asInt(input.scoreB, `${config.scoreLabel} B`);
  const match = await selectOne<MatchRow>("SELECT * FROM matches WHERE id = ?", [
    id,
  ]);
  if (!match) throw new Error("Spiel wurde nicht gefunden.");
  if (!match.teamAId || !match.teamBId)
    throw new Error("Für dieses Spiel stehen die Teams noch nicht fest.");
  if (scoreA === scoreB && (match.phase !== "group" || !config.allowDraws))
    throw new Error(
      match.phase === "group"
        ? "Unentschieden sind in diesem Turnier nicht erlaubt."
        : "KO-Spiele dürfen nicht unentschieden enden.",
    );

  const statements: BatchStatement[] = [
    {
      sql: "UPDATE matches SET score_a = ?, score_b = ?, status = 'finished' WHERE id = ?",
      params: [scoreA, scoreB, id],
    },
  ];

  // The winner moves on into the configured slot of the following match.
  if (match.phase !== "group" && match.nextMatchId && match.nextMatchSlot) {
    const winnerId = scoreA > scoreB ? match.teamAId : match.teamBId;
    statements.push({
      sql:
        match.nextMatchSlot === "A"
          ? "UPDATE matches SET team_a_id = ? WHERE id = ?"
          : "UPDATE matches SET team_b_id = ? WHERE id = ?",
      params: [winnerId, match.nextMatchId],
    });
  }

  // Both semifinal losers meet in the match for third place. The semifinal
  // feeding slot A of the final also feeds slot A of the third-place match.
  if (match.phase === "semifinal") {
    const loserId = scoreA < scoreB ? match.teamAId : match.teamBId;
    const thirdPlace = await selectOne<MatchRow>(
      "SELECT * FROM matches WHERE phase = 'thirdPlace' LIMIT 1",
    );
    if (thirdPlace)
      statements.push({
        sql:
          match.nextMatchSlot === "B"
            ? "UPDATE matches SET team_b_id = ? WHERE id = ?"
            : "UPDATE matches SET team_a_id = ? WHERE id = ?",
        params: [loserId, thirdPlace.id],
      });
  }

  await batch(statements);
}

export async function updateSettings(input: Record<string, unknown>) {
  const modes: DisplayMode[] = [
    "auto",
    "schedule",
    "standings",
    "matches",
    "bracket",
    "ranking",
  ];
  const displayMode = String(input.displayMode) as DisplayMode;
  if (!modes.includes(displayMode))
    throw new Error("Display-Modus ist ungültig.");
  await run(
    `UPDATE tournament_settings
     SET display_mode = ?, display_rotation_seconds = ?
     WHERE id = 1`,
    [
      displayMode,
      asInt(input.displayRotationSeconds ?? 10, "Wechselzeit", 3),
    ],
  );
}

// ---------------------------------------------------------------------------
// Schedule generators
// ---------------------------------------------------------------------------

/** Circle-method round robin: every team meets every other exactly once. */
export function roundRobinRounds(ids: number[]): [number, number][][] {
  const list = [...ids];
  if (list.length % 2) list.push(-1); // bye
  const size = list.length;
  const rounds: [number, number][][] = [];
  for (let round = 0; round < size - 1; round++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < size / 2; i++) {
      const a = list[i];
      const b = list[size - 1 - i];
      if (a !== -1 && b !== -1) pairs.push(round % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

interface PlannedMatch {
  groupId: number;
  teamAId: number;
  teamBId: number;
}

/**
 * Packs group fixtures into time slots. Each slot holds at most one match per
 * playing surface and a team never plays twice in the same slot.
 */
export function packIntoSlots(
  groupFixtures: { groupId: number; rounds: [number, number][][] }[],
  surfaceCount: number,
): PlannedMatch[][] {
  const slots: { matches: PlannedMatch[]; busy: Set<number> }[] = [];
  const maxRounds = Math.max(0, ...groupFixtures.map((g) => g.rounds.length));
  for (let round = 0; round < maxRounds; round++)
    for (const group of groupFixtures)
      for (const [teamAId, teamBId] of group.rounds[round] ?? []) {
        let index = 0;
        for (;;) {
          slots[index] ??= { matches: [], busy: new Set() };
          const slot = slots[index];
          if (
            slot.matches.length < surfaceCount &&
            !slot.busy.has(teamAId) &&
            !slot.busy.has(teamBId)
          )
            break;
          index++;
        }
        slots[index].matches.push({ groupId: group.groupId, teamAId, teamBId });
        slots[index].busy.add(teamAId).add(teamBId);
      }
  return slots.map((slot) => slot.matches);
}

export async function generateRoundRobin(input: Record<string, unknown>) {
  const config = await loadConfig();
  if (!usesGroups(config))
    throw new Error("Dieses Turnierformat hat keine Gruppenphase.");
  const groupRows = await selectAll<Group>(
    "SELECT * FROM groups ORDER BY name ASC",
  );
  const teamRows = await selectAll<Team>("SELECT * FROM teams ORDER BY id ASC");
  if (groupRows.length !== config.groupCount)
    throw new Error(
      `Benötigt werden genau ${config.groupCount} Gruppen (aktuell ${groupRows.length}).`,
    );
  const members = groupRows.map((group) =>
    teamRows.filter((team) => team.groupId === group.id),
  );
  if (members.some((groupTeams) => groupTeams.length < 2))
    throw new Error("Jede Gruppe braucht mindestens zwei Teilnehmer.");
  if (members.some((groupTeams) => groupTeams.length > config.groupSize))
    throw new Error(
      `Eine Gruppe darf höchstens ${config.groupSize} Teilnehmer enthalten.`,
    );
  if (teamRows.some((team) => team.groupId === null))
    throw new Error("Alle Teilnehmer müssen einer Gruppe zugeordnet sein.");
  if ((await count("SELECT COUNT(*) FROM rounds WHERE phase = 'group'")) > 0)
    throw new Error("Der Gruppenspielplan wurde bereits angelegt.");

  const startAt = Date.parse(
    await timeOnTournamentDate(input.scheduledStart, "Startzeit"),
  );
  const durationSeconds = minutesInput(
    input.durationMinutes,
    config.groupMatchMinutes,
    "Spieldauer",
  );
  const slotSeconds = durationSeconds + config.breakMinutes * 60;

  const slots = packIntoSlots(
    groupRows.map((group, index) => ({
      groupId: group.id,
      rounds: roundRobinRounds(members[index].map((team) => team.id)),
    })),
    config.surfaceCount,
  );

  const statements: BatchStatement[] = [];
  const push = (sql: string, params: Param[] = []) =>
    statements.push({ sql, params }) - 1;

  slots.forEach((slotMatches, slot) => {
    const scheduledAt = new Date(startAt + slot * slotSeconds * 1000).toISOString();
    const roundIndex = push(
      `INSERT INTO rounds (round_number, phase, name, scheduled_start, duration_seconds)
       VALUES (?, 'group', ?, ?, ?)`,
      [slot + 1, `Gruppenrunde ${slot + 1}`, scheduledAt, durationSeconds],
    );
    slotMatches.forEach((match, table) =>
      push(
        `INSERT INTO matches
           (phase, group_id, round_id, round, table_number, scheduled_at, team_a_id, team_b_id)
         VALUES ('group', ?, ?, ?, ?, ?, ?, ?)`,
        [
          match.groupId,
          lastInsertId(roundIndex),
          slot + 1,
          table + 1,
          scheduledAt,
          match.teamAId,
          match.teamBId,
        ],
      ),
    );
  });
  await batch(statements);
}

/** Standard bracket order so that seed 1 and seed 2 can only meet in the final. */
export function bracketSeedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next: number[] = [];
    const total = order.length * 2 + 1;
    for (const seed of order) next.push(seed, total - seed);
    order = next;
  }
  return order;
}

export async function generateKnockout(input: Record<string, unknown>) {
  const config = await loadConfig();
  if (!usesKnockout(config))
    throw new Error("Dieses Turnierformat hat keine KO-Phase.");
  if ((await count("SELECT COUNT(*) FROM rounds WHERE phase != 'group'")) > 0)
    throw new Error("Die KO-Phase wurde bereits angelegt.");

  const size = knockoutTeamCount(config);
  const teamRows = await selectAll<Team>("SELECT * FROM teams ORDER BY id ASC");
  let seeds: number[];

  if (config.format === "groupsKnockout") {
    const groupRows = await selectAll<Group>(
      "SELECT * FROM groups ORDER BY name ASC",
    );
    if (groupRows.length !== config.groupCount)
      throw new Error(`Für die KO-Phase werden genau ${config.groupCount} Gruppen benötigt.`);
    const groupMatches = await selectAll<MatchRow>(
      "SELECT * FROM matches WHERE phase = 'group'",
    );
    if (
      !groupMatches.length ||
      groupMatches.some((match) => match.status !== "finished")
    )
      throw new Error("Alle Gruppenspiele müssen vor der KO-Phase beendet sein.");
    const ranked = groupRows.map((group) =>
      calculateStandings(
        config,
        teamRows.filter((team) => team.groupId === group.id),
        groupMatches.filter((match) => match.groupId === group.id),
      ),
    );
    if (ranked.some((rows) => rows.length < config.advancingPerGroup))
      throw new Error(
        `Jede Gruppe braucht mindestens ${config.advancingPerGroup} Teilnehmer.`,
      );
    // Seed by finishing position first, then by group: all winners, then all
    // runners-up, and so on. Group winners thereby avoid each other early.
    seeds = [];
    for (let position = 0; position < config.advancingPerGroup; position++)
      for (const rows of ranked) seeds.push(rows[position].team.id);
  } else {
    if (teamRows.length !== size)
      throw new Error(
        `Die KO-Phase braucht genau ${size} Teilnehmer (aktuell ${teamRows.length}).`,
      );
    seeds = teamRows.map((team) => team.id);
    for (let i = seeds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
    }
  }

  const startAt = Date.parse(
    await timeOnTournamentDate(
      input.scheduledStart ?? input.knockoutStart,
      "Startzeit KO-Phase",
    ),
  );
  const durationSeconds = minutesInput(
    input.durationMinutes,
    config.knockoutMatchMinutes,
    "Spieldauer",
  );
  const slotSeconds = durationSeconds + config.breakMinutes * 60;
  const phases = bracketPhases(size, config.thirdPlaceMatch);

  const statements: BatchStatement[] = [];
  const push = (sql: string, params: Param[] = []) =>
    statements.push({ sql, params }) - 1;

  // Every phase may need several time slots when it has more matches than
  // playing surfaces. Each slot is its own round with its own timer.
  const matchCount = (phase: Phase) =>
    phase === "thirdPlace" || phase === "final"
      ? 1
      : size / 2 / (1 << phases.filter((p) => p !== "thirdPlace").indexOf(phase));
  const slotOf = new Map<string, { round: number; table: number; time: string }>();
  let slot = 0;
  for (const phase of phases) {
    const total = matchCount(phase);
    const chunks = Math.ceil(total / config.surfaceCount);
    for (let chunk = 0; chunk < chunks; chunk++) {
      const time = new Date(startAt + slot * slotSeconds * 1000).toISOString();
      const name =
        chunks > 1
          ? `${PHASE_LABELS[phase]} (${chunk + 1}/${chunks})`
          : PHASE_LABELS[phase];
      const round = push(
        `INSERT INTO rounds (round_number, phase, name, scheduled_start, duration_seconds)
         VALUES (?, ?, ?, ?, ?)`,
        [chunk + 1, phase, name, time, durationSeconds],
      );
      for (
        let index = chunk * config.surfaceCount;
        index < Math.min(total, (chunk + 1) * config.surfaceCount);
        index++
      )
        slotOf.set(`${phase}:${index}`, {
          round,
          table: (index % config.surfaceCount) + 1,
          time,
        });
      slot++;
    }
  }

  // Insert from the final backwards so every match can reference its successor.
  const matchIndex = new Map<string, number>();
  const insertMatch = (
    phase: Phase,
    index: number,
    teamAId: number | null,
    teamBId: number | null,
    next: { phase: Phase; index: number; slotLabel: "A" | "B" } | null,
  ) => {
    const place = slotOf.get(`${phase}:${index}`)!;
    const statement = push(
      `INSERT INTO matches
         (phase, round_id, round, table_number, scheduled_at, team_a_id, team_b_id,
          next_match_id, next_match_slot)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      [
        phase,
        lastInsertId(place.round),
        place.table,
        place.time,
        teamAId,
        teamBId,
        next ? lastInsertId(matchIndex.get(`${next.phase}:${next.index}`)!) : null,
        next ? next.slotLabel : null,
      ],
    );
    matchIndex.set(`${phase}:${index}`, statement);
  };

  insertMatch("final", 0, null, null, null);
  if (config.thirdPlaceMatch && size >= 4) insertMatch("thirdPlace", 0, null, null, null);

  const playPhases = phases.filter((phase) => phase !== "thirdPlace");
  const order = bracketSeedOrder(size);
  for (let level = playPhases.length - 2; level >= 0; level--) {
    const phase = playPhases[level];
    const nextPhase = playPhases[level + 1];
    const matches = size / 2 / (1 << level);
    for (let index = 0; index < matches; index++) {
      const first = level === 0;
      insertMatch(
        phase,
        index,
        first ? seeds[order[index * 2] - 1] : null,
        first ? seeds[order[index * 2 + 1] - 1] : null,
        {
          phase: nextPhase,
          index: Math.floor(index / 2),
          slotLabel: index % 2 === 0 ? "A" : "B",
        },
      );
    }
  }
  if (size === 2) {
    // A two-team bracket is just the final itself.
    statements[matchIndex.get("final:0")!].params![4] = seeds[0];
    statements[matchIndex.get("final:0")!].params![5] = seeds[1];
  }
  await batch(statements);
}
