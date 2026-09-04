import { invoke } from "@tauri-apps/api/core";

/** Reference to the row id created by an earlier statement of the same batch. */
export interface LastInsertRef {
  $lastInsertId: number;
}
export type Param = string | number | boolean | null | LastInsertRef;

export interface BatchStatement {
  sql: string;
  params?: Param[];
}
export interface StatementResult {
  lastInsertId: number;
  rowsAffected: number;
}

/**
 * Points at the row inserted by statement number `index` of the current batch,
 * counting from zero. Used to link matches to the round they belong to without
 * leaving the transaction.
 */
export const lastInsertId = (index: number): LastInsertRef => ({
  $lastInsertId: index,
});

const camelCase = (column: string) =>
  column.replace(/_([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  );

const toCamelCaseRow = <T>(row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).map(([column, value]) => [camelCase(column), value]),
  ) as T;

/** Runs a SELECT and returns every row with camelCase keys. */
export async function selectAll<T>(
  sql: string,
  params: Param[] = [],
): Promise<T[]> {
  const rows = await invoke<Record<string, unknown>[]>("db_select", {
    sql,
    params,
  });
  return rows.map((row) => toCamelCaseRow<T>(row));
}

/** Runs a SELECT and returns the first row, or null when there is none. */
export async function selectOne<T>(
  sql: string,
  params: Param[] = [],
): Promise<T | null> {
  const rows = await selectAll<T>(sql, params);
  return rows[0] ?? null;
}

/** Counts rows for queries of the form `SELECT COUNT(*) ... `. */
export async function count(sql: string, params: Param[] = []): Promise<number> {
  const row = await selectOne<Record<string, unknown>>(sql, params);
  return Number(Object.values(row ?? {})[0] ?? 0);
}

/** Executes statements together; any failure rolls all of them back. */
export async function batch(
  statements: BatchStatement[],
): Promise<StatementResult[]> {
  return invoke<StatementResult[]>("db_batch", {
    statements: statements.map(({ sql, params = [] }) => ({ sql, params })),
  });
}

/** Executes a single statement. */
export async function run(
  sql: string,
  params: Param[] = [],
): Promise<StatementResult> {
  const [result] = await batch([{ sql, params }]);
  return result;
}
