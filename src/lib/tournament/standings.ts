import type { Match, Standing, Team } from "$lib/types/tournament";
import type { TournamentConfig } from "./config";

/** The subset of a match that standings need; works with raw rows too. */
export type ResultLike = Pick<
  Match,
  "teamAId" | "teamBId" | "scoreA" | "scoreB" | "status"
>;

const finished = (match: ResultLike) =>
  match.status === "finished" &&
  match.teamAId !== null &&
  match.teamBId !== null &&
  match.scoreA !== null &&
  match.scoreB !== null;

/** Points team `a` collected against team `b` in their direct matches. */
function headToHeadPoints(
  config: TournamentConfig,
  matches: ResultLike[],
  a: number,
  b: number,
) {
  let points = 0;
  for (const match of matches) {
    if (!finished(match)) continue;
    const isAB = match.teamAId === a && match.teamBId === b;
    const isBA = match.teamAId === b && match.teamBId === a;
    if (!isAB && !isBA) continue;
    const scoreA = isAB ? match.scoreA! : match.scoreB!;
    const scoreB = isAB ? match.scoreB! : match.scoreA!;
    points +=
      scoreA > scoreB
        ? config.pointsWin
        : scoreA < scoreB
          ? config.pointsLoss
          : config.pointsDraw;
  }
  return points;
}

/** Sort comparator for standings rows following the configured tiebreakers. */
export function compareStandings(
  config: TournamentConfig,
  matches: ResultLike[],
) {
  return (a: Standing, b: Standing) => {
    for (const rule of config.tiebreakers) {
      let diff = 0;
      if (rule === "points") diff = b.points - a.points;
      else if (rule === "wins") diff = b.won - a.won;
      else if (rule === "scoreDiff") diff = b.scoreDiff - a.scoreDiff;
      else if (rule === "scoreFor") diff = b.scoreFor - a.scoreFor;
      else if (rule === "headToHead")
        diff =
          headToHeadPoints(config, matches, b.team.id, a.team.id) -
          headToHeadPoints(config, matches, a.team.id, b.team.id);
      if (diff !== 0) return diff;
    }
    return a.team.name.localeCompare(b.team.name, "de");
  };
}

export function calculateStandings(
  config: TournamentConfig,
  teams: Team[],
  matches: ResultLike[],
): Standing[] {
  const table = new Map<number, Standing>(
    teams.map((team) => [
      team.id,
      {
        position: 0,
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDiff: 0,
        points: 0,
      },
    ]),
  );
  for (const match of matches) {
    if (!finished(match)) continue;
    const a = table.get(match.teamAId!);
    const b = table.get(match.teamBId!);
    if (!a || !b) continue;
    const scoreA = match.scoreA!;
    const scoreB = match.scoreB!;
    a.played++;
    b.played++;
    a.scoreFor += scoreA;
    a.scoreAgainst += scoreB;
    b.scoreFor += scoreB;
    b.scoreAgainst += scoreA;
    if (scoreA > scoreB) {
      a.won++;
      b.lost++;
      a.points += config.pointsWin;
      b.points += config.pointsLoss;
    } else if (scoreB > scoreA) {
      b.won++;
      a.lost++;
      b.points += config.pointsWin;
      a.points += config.pointsLoss;
    } else {
      a.drawn++;
      b.drawn++;
      a.points += config.pointsDraw;
      b.points += config.pointsDraw;
    }
  }
  for (const row of table.values()) row.scoreDiff = row.scoreFor - row.scoreAgainst;
  const result = [...table.values()].sort(compareStandings(config, matches));
  result.forEach((row, index) => (row.position = index + 1));
  return result;
}
