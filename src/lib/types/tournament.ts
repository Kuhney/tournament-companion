import type { TournamentConfig } from "$lib/tournament/config";

export type Phase =
  | "group"
  | "roundOf32"
  | "roundOf16"
  | "quarterfinal"
  | "semifinal"
  | "thirdPlace"
  | "final";
export type MatchStatus = "scheduled" | "running" | "finished";
export type RoundStatus = "scheduled" | "running" | "paused" | "finished";
export type DisplayMode =
  | "auto"
  | "schedule"
  | "standings"
  | "matches"
  | "bracket"
  | "ranking";

export interface Team {
  id: number;
  name: string;
  players: string;
  shortName: string | null;
  color: string | null;
  logo: string | null;
  groupId: number | null;
}
export interface Group {
  id: number;
  name: string;
}
export interface Match {
  id: number;
  phase: Phase;
  groupId: number | null;
  roundId: number;
  round: number;
  tableNumber: number;
  scheduledAt: string;
  teamAId: number | null;
  teamBId: number | null;
  scoreA: number | null;
  scoreB: number | null;
  status: MatchStatus;
  nextMatchId: number | null;
  nextMatchSlot: "A" | "B" | null;
  teamA: Team | null;
  teamB: Team | null;
  group: Group | null;
}
export interface TournamentRound {
  id: number;
  roundNumber: number;
  phase: Phase;
  name: string;
  scheduledStart: string | null;
  startedAt: string | null;
  endTime: string | null;
  remainingSeconds: number | null;
  durationSeconds: number;
  status: RoundStatus;
}
export interface Standing {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDiff: number;
  points: number;
}
export interface Settings {
  id: number;
  currentPhase: Phase;
  currentRoundId: number | null;
  displayMode: DisplayMode;
  displayRotationSeconds: number;
}
export interface TournamentState {
  generatedAt: string;
  config: TournamentConfig;
  teams: Team[];
  groups: Group[];
  matches: Match[];
  rounds: TournamentRound[];
  settings: Settings;
  currentRound: TournamentRound | null;
  standings: Record<number, Standing[]>;
  nextMatches: Match[];
  qualifiedTeams: Team[];
}
