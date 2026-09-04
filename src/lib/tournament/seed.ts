import { batch, lastInsertId, type BatchStatement, type Param } from "$lib/db/client";
import { BRAND_COLORS, maxTeams, usesGroups } from "./config";
import {
  generateKnockout,
  generateRoundRobin,
  loadConfig,
  resetTournament,
} from "./service";

const TEAM_NAMES = [
  "Rote Raketen", "Blaue Blitze", "Grüne Giganten", "Goldene Geier",
  "Silberpfeile", "Wilde Wölfe", "Flinke Füchse", "Starke Stiere",
  "Nachteulen", "Sturmvögel", "Feuerdrachen", "Eisbären",
  "Donnerhasen", "Kühle Kojoten", "Schnelle Schnecken", "Lila Lamas",
  "Bunte Bienen", "Graue Gnus", "Tolle Tiger", "Krasse Kraken",
  "Muntere Murmeltiere", "Freche Frösche", "Pinke Pinguine", "Zackige Zebras",
  "Orange Otter", "Lustige Luchse", "Dicke Dachse", "Schräge Schwäne",
  "Heiße Hummeln", "Coole Kobras", "Ruhige Robben", "Wackere Waschbären",
];
const PLAYER_NAMES = [
  "Marie", "Olli", "Vici", "Ange", "Lawa", "Leyla", "Maya", "Johanna",
  "Jojo", "Svenja", "Carolin", "Norina", "Marven", "Silas", "Gabriel", "Max",
  "Hannes", "Leon", "Marc", "Jenz", "Raphi", "Barbara", "Oxana", "Jonas",
  "Philip", "Pascal", "Nicola", "Lucas", "Paula", "Tim", "Lena", "Finn",
  "Mia", "Noah", "Emma", "Ben", "Lea", "Luis", "Anna", "Paul",
  "Sarah", "Jan", "Laura", "Tom", "Julia", "Felix", "Nina", "David",
  "Sophie", "Moritz", "Hanna", "Jakob", "Clara", "Simon", "Lina", "Elias",
  "Marlene", "Oskar", "Frida", "Anton", "Ida", "Emil", "Greta", "Theo",
];

const shortName = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

/**
 * Replaces the whole database with an example tournament that matches the
 * current configuration: full groups, generic teams and a generated schedule
 * starting in half an hour. Never run this during a real tournament.
 */
export async function seedExampleTournament() {
  const config = await loadConfig();
  await resetTournament({ scope: "all" });

  const statements: BatchStatement[] = [];
  const push = (sql: string, params: Param[] = []) =>
    statements.push({ sql, params }) - 1;

  const groupIndexes = usesGroups(config)
    ? Array.from({ length: config.groupCount }, (_, index) =>
        push("INSERT INTO groups (name) VALUES (?)", [
          `Gruppe ${String.fromCharCode(65 + index)}`,
        ]),
      )
    : [];

  const teamCount = Math.min(maxTeams(config), TEAM_NAMES.length);
  for (let index = 0; index < teamCount; index++) {
    const name = TEAM_NAMES[index];
    const players = config.showPlayers
      ? `${PLAYER_NAMES[(index * 2) % PLAYER_NAMES.length]} & ${PLAYER_NAMES[(index * 2 + 1) % PLAYER_NAMES.length]}`
      : "";
    push(
      `INSERT INTO teams (name, players, short_name, color, group_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name,
        players,
        shortName(name),
        BRAND_COLORS[index % BRAND_COLORS.length].hex,
        groupIndexes.length
          ? lastInsertId(groupIndexes[index % groupIndexes.length])
          : null,
      ],
    );
  }
  await batch(statements);

  const start = new Date(Date.now() + 30 * 60_000).toISOString();
  if (usesGroups(config)) await generateRoundRobin({ scheduledStart: start });
  else await generateKnockout({ scheduledStart: start });
}
