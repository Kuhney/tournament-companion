import type { TournamentState } from "$lib/types/tournament";
import { seedExampleTournament } from "./seed";
import {
  controlRound,
  createGroup,
  createMatch,
  createRound,
  createTeam,
  deleteGroup,
  deleteMatch,
  deleteRound,
  deleteTeam,
  generateKnockout,
  generateRoundRobin,
  getState,
  resetTournament,
  saveResult,
  shuffleGroups,
  updateConfig,
  updateDisplay,
  updateGroup,
  updateMatch,
  updateRound,
  updateSettings,
  updateTeam,
} from "./service";

export type ActionResult =
  | { ok: true; state: TournamentState }
  | { ok: false; error: string };

/**
 * Mutations run one after another. The admin window polls while the user works,
 * so serialising keeps a validation from reading state that a half applied
 * action is still changing.
 */
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const result = queue.then(task, task);
  queue = result.catch(() => undefined);
  return result;
};

export const fetchState = (): Promise<TournamentState> => getState();

const ACTIONS: Record<string, (body: Record<string, unknown>) => Promise<void>> = {
  "config.update": updateConfig,
  "team.create": createTeam,
  "team.update": updateTeam,
  "team.delete": deleteTeam,
  "group.create": createGroup,
  "group.update": updateGroup,
  "group.delete": deleteGroup,
  "group.shuffle": () => shuffleGroups(),
  "round.create": createRound,
  "round.update": updateRound,
  "round.delete": deleteRound,
  "round.start": (body) => controlRound("start", body),
  "round.pause": (body) => controlRound("pause", body),
  "round.resume": (body) => controlRound("resume", body),
  "round.adjust": (body) => controlRound("adjust", body),
  "round.finish": (body) => controlRound("finish", body),
  "round.reset": (body) => controlRound("reset", body),
  "match.create": createMatch,
  "match.update": updateMatch,
  "match.delete": deleteMatch,
  "match.result": saveResult,
  "schedule.roundRobin": generateRoundRobin,
  "schedule.knockout": generateKnockout,
  "settings.update": updateSettings,
  "display.update": updateDisplay,
  "data.reset": resetTournament,
  "data.seed": () => seedExampleTournament(),
};

/** Runs one admin action and returns the fresh state or an error message. */
export function performAction(
  body: Record<string, unknown>,
): Promise<ActionResult> {
  return enqueue(async () => {
    try {
      const handler = ACTIONS[String(body.action ?? "")];
      if (!handler) throw new Error("Unbekannte Aktion.");
      await handler(body);
      return { ok: true as const, state: await getState() };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error
            ? error.message
            : String(error) || "Die Aktion ist fehlgeschlagen.",
      };
    }
  });
}
