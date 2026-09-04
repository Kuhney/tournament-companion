import type { Phase } from "$lib/types/tournament";

export type Format = "groupsKnockout" | "groups" | "knockout";
export type Tiebreaker =
  | "points"
  | "wins"
  | "scoreDiff"
  | "scoreFor"
  | "headToHead";
export type PresetId =
  | "bierpong"
  | "tischkicker"
  | "fussball"
  | "darts"
  | "custom";

/** Everything that makes one tournament different from another. */
export interface TournamentConfig {
  version: 1;
  preset: PresetId;
  setupDone: boolean;

  // Branding
  name: string;
  subtitle: string;
  sport: string;
  accentColor: string;
  /** Data URL of an uploaded image, or null for the generic emblem. */
  logo: string | null;

  // Format
  format: Format;
  groupCount: number;
  groupSize: number;
  advancingPerGroup: number;
  /** Bracket size for the knockout-only format. */
  knockoutTeams: number;
  thirdPlaceMatch: boolean;
  surfaceCount: number;
  surfaceLabel: string;
  participantLabel: string;
  participantLabelPlural: string;
  showPlayers: boolean;

  // Scoring
  scoreLabel: string;
  allowDraws: boolean;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  tiebreakers: Tiebreaker[];

  // Timing (minutes)
  groupMatchMinutes: number;
  knockoutMatchMinutes: number;
  breakMinutes: number;

  // TV display
  /** Zoom of the whole display in percent, 50 to 200. */
  displayScalePercent: number;
  /** Safe-area margin in percent of the screen, counters TV overscan. */
  displayMarginPercent: number;
  displayShowHeader: boolean;
  /** Calibration frame with corner markers to check the visible area. */
  displayShowGuides: boolean;
}

export const DISPLAY_FIELDS = [
  "displayScalePercent",
  "displayMarginPercent",
  "displayShowHeader",
  "displayShowGuides",
] as const satisfies readonly (keyof TournamentConfig)[];

/** The brand palette, offered as quick picks for accent and team colours. */
export const BRAND_COLORS: { name: string; hex: string }[] = [
  { name: "Gelb", hex: "#ffed00" },
  { name: "Blau", hex: "#004588" },
  { name: "Pink", hex: "#db0076" },
  { name: "Grün", hex: "#97bf0d" },
  { name: "Grau", hex: "#ede8ec" },
];

export const FORMAT_LABELS: Record<Format, string> = {
  groupsKnockout: "Gruppenphase + KO-Phase",
  groups: "Nur Gruppenphase (Liga)",
  knockout: "Nur KO-Phase",
};

export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  points: "Punkte",
  wins: "Siege",
  scoreDiff: "Differenz",
  scoreFor: "Erzielte Treffer",
  headToHead: "Direkter Vergleich",
};

export const PHASE_LABELS: Record<Phase, string> = {
  group: "Gruppenphase",
  roundOf32: "Sechzehntelfinale",
  roundOf16: "Achtelfinale",
  quarterfinal: "Viertelfinale",
  semifinal: "Halbfinale",
  thirdPlace: "Spiel um Platz 3",
  final: "Finale",
};

/** Knockout phases in the order they are played. */
export const KNOCKOUT_PHASES: Phase[] = [
  "roundOf32",
  "roundOf16",
  "quarterfinal",
  "semifinal",
  "thirdPlace",
  "final",
];

/** The phase played when this many teams are still in the bracket. */
export const PHASE_BY_TEAMS: Record<number, Phase> = {
  32: "roundOf32",
  16: "roundOf16",
  8: "quarterfinal",
  4: "semifinal",
  2: "final",
};

export const DEFAULT_CONFIG: TournamentConfig = {
  version: 1,
  preset: "custom",
  setupDone: false,
  name: "Turnier",
  subtitle: "",
  sport: "Turnier",
  accentColor: "#e60000",
  logo: null,
  format: "groupsKnockout",
  groupCount: 4,
  groupSize: 4,
  advancingPerGroup: 2,
  knockoutTeams: 8,
  thirdPlaceMatch: true,
  surfaceCount: 4,
  surfaceLabel: "Feld",
  participantLabel: "Team",
  participantLabelPlural: "Teams",
  showPlayers: true,
  scoreLabel: "Punkte",
  allowDraws: false,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  tiebreakers: ["points", "scoreDiff", "scoreFor", "headToHead"],
  groupMatchMinutes: 15,
  knockoutMatchMinutes: 20,
  breakMinutes: 5,
  displayScalePercent: 100,
  displayMarginPercent: 2,
  displayShowHeader: true,
  displayShowGuides: false,
};

export interface Preset {
  id: PresetId;
  label: string;
  description: string;
  values: Partial<TournamentConfig>;
}

export const PRESETS: Preset[] = [
  {
    id: "bierpong",
    label: "Bierpong",
    description: "16 Teams, vier Gruppen, vier Tische, Becher zählen.",
    values: {
      sport: "Bierpong",
      accentColor: "#e60000",
      format: "groupsKnockout",
      groupCount: 4,
      groupSize: 4,
      advancingPerGroup: 2,
      thirdPlaceMatch: true,
      surfaceCount: 4,
      surfaceLabel: "Tisch",
      participantLabel: "Team",
      participantLabelPlural: "Teams",
      showPlayers: true,
      scoreLabel: "Becher",
      allowDraws: false,
      pointsWin: 1,
      pointsDraw: 0,
      pointsLoss: 0,
      tiebreakers: ["points", "scoreFor"],
      groupMatchMinutes: 15,
      knockoutMatchMinutes: 20,
      breakMinutes: 5,
    },
  },
  {
    id: "tischkicker",
    label: "Tischkicker",
    description: "Zwei Gruppen, zwei Tische, Tore zählen, kein Unentschieden.",
    values: {
      sport: "Tischkicker",
      accentColor: "#f59e0b",
      format: "groupsKnockout",
      groupCount: 2,
      groupSize: 4,
      advancingPerGroup: 2,
      thirdPlaceMatch: true,
      surfaceCount: 2,
      surfaceLabel: "Tisch",
      participantLabel: "Team",
      participantLabelPlural: "Teams",
      showPlayers: true,
      scoreLabel: "Tore",
      allowDraws: false,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tiebreakers: ["points", "scoreDiff", "scoreFor", "headToHead"],
      groupMatchMinutes: 10,
      knockoutMatchMinutes: 12,
      breakMinutes: 3,
    },
  },
  {
    id: "fussball",
    label: "Fußball",
    description: "Kleinfeldturnier mit Unentschieden und Drei-Punkte-Regel.",
    values: {
      sport: "Fußball",
      accentColor: "#16a34a",
      format: "groupsKnockout",
      groupCount: 4,
      groupSize: 4,
      advancingPerGroup: 2,
      thirdPlaceMatch: true,
      surfaceCount: 2,
      surfaceLabel: "Platz",
      participantLabel: "Mannschaft",
      participantLabelPlural: "Mannschaften",
      showPlayers: false,
      scoreLabel: "Tore",
      allowDraws: true,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tiebreakers: ["points", "scoreDiff", "scoreFor", "headToHead"],
      groupMatchMinutes: 12,
      knockoutMatchMinutes: 15,
      breakMinutes: 3,
    },
  },
  {
    id: "darts",
    label: "Darts",
    description: "Einzelspieler, Legs zählen, kein Unentschieden.",
    values: {
      sport: "Darts",
      accentColor: "#2563eb",
      format: "groupsKnockout",
      groupCount: 4,
      groupSize: 4,
      advancingPerGroup: 2,
      thirdPlaceMatch: false,
      surfaceCount: 4,
      surfaceLabel: "Board",
      participantLabel: "Spieler",
      participantLabelPlural: "Spieler",
      showPlayers: false,
      scoreLabel: "Legs",
      allowDraws: false,
      pointsWin: 2,
      pointsDraw: 0,
      pointsLoss: 0,
      tiebreakers: ["points", "scoreDiff", "scoreFor", "headToHead"],
      groupMatchMinutes: 15,
      knockoutMatchMinutes: 20,
      breakMinutes: 5,
    },
  },
  {
    id: "custom",
    label: "Eigenes Turnier",
    description: "Alle Optionen frei wählen.",
    values: {},
  },
];

export const isPowerOfTwo = (value: number) =>
  Number.isInteger(value) && value >= 2 && (value & (value - 1)) === 0;

export const usesGroups = (config: TournamentConfig) =>
  config.format !== "knockout";
export const usesKnockout = (config: TournamentConfig) =>
  config.format !== "groups";

/** Upper bound for the number of teams the current format can hold. */
export function maxTeams(config: TournamentConfig) {
  return config.format === "knockout"
    ? config.knockoutTeams
    : config.groupCount * config.groupSize;
}

/** Number of teams entering the bracket, or 0 when there is none. */
export function knockoutTeamCount(config: TournamentConfig) {
  if (config.format === "knockout") return config.knockoutTeams;
  if (config.format === "groupsKnockout")
    return config.groupCount * config.advancingPerGroup;
  return 0;
}

export function applyPreset(
  config: TournamentConfig,
  presetId: PresetId,
): TournamentConfig {
  const preset = PRESETS.find((item) => item.id === presetId);
  return { ...config, ...(preset?.values ?? {}), preset: presetId };
}

const intIn = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  field: string,
) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max)
    throw new Error(`${field} muss zwischen ${min} und ${max} liegen.`);
  return parsed;
};
const text = (value: unknown, fallback: string, max = 60) => {
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
};
const bool = (value: unknown, fallback: boolean) =>
  value === undefined || value === null
    ? fallback
    : value === true || value === "true" || value === "on" || value === 1;

const TIEBREAKERS = Object.keys(TIEBREAKER_LABELS) as Tiebreaker[];

/**
 * Turns anything (an old JSON blob, a form submission, a preset) into a full,
 * validated configuration. Unknown fields are dropped and missing ones filled
 * from the defaults, so stored configs stay readable after new options appear.
 */
export function normalizeConfig(input: unknown): TournamentConfig {
  const raw = (
    input && typeof input === "object" ? input : {}
  ) as Record<string, unknown>;
  const d = DEFAULT_CONFIG;

  const format = (["groupsKnockout", "groups", "knockout"] as Format[]).includes(
    raw.format as Format,
  )
    ? (raw.format as Format)
    : d.format;
  const preset = PRESETS.some((item) => item.id === raw.preset)
    ? (raw.preset as PresetId)
    : "custom";

  let tiebreakers = Array.isArray(raw.tiebreakers)
    ? (raw.tiebreakers.filter((item) =>
        TIEBREAKERS.includes(item as Tiebreaker),
      ) as Tiebreaker[])
    : d.tiebreakers;
  tiebreakers = [...new Set(tiebreakers)];
  if (!tiebreakers.length) tiebreakers = ["points"];

  const logo =
    typeof raw.logo === "string" && raw.logo.startsWith("data:image/")
      ? raw.logo.length > 400_000
        ? (() => {
            throw new Error("Das Logo darf höchstens 300 KB groß sein.");
          })()
        : raw.logo
      : null;

  const accent = text(raw.accentColor, d.accentColor, 9);
  if (!/^#[0-9a-fA-F]{6}$/.test(accent))
    throw new Error("Die Akzentfarbe muss ein Hex-Wert wie #e60000 sein.");

  const config: TournamentConfig = {
    version: 1,
    preset,
    setupDone: bool(raw.setupDone, d.setupDone),
    name: text(raw.name, d.name),
    subtitle: text(raw.subtitle, "", 80),
    sport: text(raw.sport, d.sport, 40),
    accentColor: accent.toLowerCase(),
    logo,
    format,
    groupCount: intIn(raw.groupCount, d.groupCount, 1, 16, "Anzahl Gruppen"),
    groupSize: intIn(raw.groupSize, d.groupSize, 2, 16, "Teams je Gruppe"),
    advancingPerGroup: intIn(
      raw.advancingPerGroup,
      d.advancingPerGroup,
      1,
      8,
      "Aufsteiger je Gruppe",
    ),
    knockoutTeams: intIn(raw.knockoutTeams, d.knockoutTeams, 2, 32, "KO-Teilnehmer"),
    thirdPlaceMatch: bool(raw.thirdPlaceMatch, d.thirdPlaceMatch),
    surfaceCount: intIn(raw.surfaceCount, d.surfaceCount, 1, 16, "Spielflächen"),
    surfaceLabel: text(raw.surfaceLabel, d.surfaceLabel, 20),
    participantLabel: text(raw.participantLabel, d.participantLabel, 20),
    participantLabelPlural: text(
      raw.participantLabelPlural,
      d.participantLabelPlural,
      20,
    ),
    showPlayers: bool(raw.showPlayers, d.showPlayers),
    scoreLabel: text(raw.scoreLabel, d.scoreLabel, 20),
    allowDraws: bool(raw.allowDraws, d.allowDraws),
    pointsWin: intIn(raw.pointsWin, d.pointsWin, 0, 10, "Punkte für Sieg"),
    pointsDraw: intIn(raw.pointsDraw, d.pointsDraw, 0, 10, "Punkte für Unentschieden"),
    pointsLoss: intIn(raw.pointsLoss, d.pointsLoss, 0, 10, "Punkte für Niederlage"),
    tiebreakers,
    groupMatchMinutes: intIn(
      raw.groupMatchMinutes,
      d.groupMatchMinutes,
      1,
      180,
      "Spieldauer Gruppenphase",
    ),
    knockoutMatchMinutes: intIn(
      raw.knockoutMatchMinutes,
      d.knockoutMatchMinutes,
      1,
      180,
      "Spieldauer KO-Phase",
    ),
    breakMinutes: intIn(raw.breakMinutes, d.breakMinutes, 0, 60, "Pause"),
    displayScalePercent: intIn(
      raw.displayScalePercent,
      d.displayScalePercent,
      50,
      200,
      "Skalierung",
    ),
    displayMarginPercent: intIn(
      raw.displayMarginPercent,
      d.displayMarginPercent,
      0,
      15,
      "Bildschirmrand",
    ),
    displayShowHeader: bool(raw.displayShowHeader, d.displayShowHeader),
    displayShowGuides: bool(raw.displayShowGuides, d.displayShowGuides),
  };

  if (format === "groupsKnockout") {
    if (config.advancingPerGroup > config.groupSize)
      throw new Error(
        "Es können nicht mehr Teams aufsteigen, als eine Gruppe enthält.",
      );
    const bracket = knockoutTeamCount(config);
    if (!isPowerOfTwo(bracket) || bracket > 32)
      throw new Error(
        `Gruppen × Aufsteiger ergibt ${bracket} KO-Teilnehmer. Erlaubt sind 2, 4, 8, 16 oder 32.`,
      );
  }
  if (format === "knockout" && !isPowerOfTwo(config.knockoutTeams))
    throw new Error("Die KO-Phase braucht 2, 4, 8, 16 oder 32 Teilnehmer.");
  if (format === "groups" && config.groupCount * config.groupSize < 2)
    throw new Error("Eine Liga braucht mindestens zwei Teilnehmer.");

  return config;
}

/** Fields that change the schedule structure and are locked once rounds exist. */
export const STRUCTURAL_FIELDS: (keyof TournamentConfig)[] = [
  "format",
  "groupCount",
  "groupSize",
  "advancingPerGroup",
  "knockoutTeams",
  "thirdPlaceMatch",
  "surfaceCount",
];

/** Human readable name of one knockout phase for this bracket size. */
export function knockoutPhaseFor(teamsRemaining: number): Phase {
  const phase = PHASE_BY_TEAMS[teamsRemaining];
  if (!phase) throw new Error(`Keine KO-Runde für ${teamsRemaining} Teams.`);
  return phase;
}

/** All knockout phases in play order for a bracket of the given size. */
export function bracketPhases(size: number, thirdPlace: boolean): Phase[] {
  const phases: Phase[] = [];
  for (let remaining = size; remaining >= 2; remaining /= 2)
    phases.push(knockoutPhaseFor(remaining));
  if (thirdPlace && size >= 4) phases.splice(phases.length - 1, 0, "thirdPlace");
  return phases;
}
