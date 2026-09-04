use std::sync::Mutex;

use rusqlite::types::{Value as SqlValue, ValueRef};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value as Json};
use tauri::{AppHandle, Manager, State};

/// Every migration that has ever been applied to the tournament database.
const MIGRATIONS: &[(&str, &str)] = &[(
    "0000_initial.sql",
    include_str!("../migrations/0000_initial.sql"),
)];

pub struct Db(pub Mutex<Connection>);

/// A single statement inside a batch.
///
/// `params` may contain a `{ "$lastInsertId": <index> }` object, which is
/// replaced by the row id inserted by an earlier statement of the same batch.
/// That lets callers insert a parent row and reference its id from later
/// statements without leaving the transaction.
#[derive(Debug, Deserialize)]
pub struct Statement {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<Json>,
}

#[derive(Debug, Serialize)]
pub struct StatementResult {
    #[serde(rename = "lastInsertId")]
    pub last_insert_id: i64,
    #[serde(rename = "rowsAffected")]
    pub rows_affected: usize,
}

fn to_sql_value(value: &Json) -> Result<SqlValue, String> {
    Ok(match value {
        Json::Null => SqlValue::Null,
        Json::Bool(flag) => SqlValue::Integer(i64::from(*flag)),
        Json::Number(number) => {
            if let Some(int) = number.as_i64() {
                SqlValue::Integer(int)
            } else if let Some(float) = number.as_f64() {
                SqlValue::Real(float)
            } else {
                return Err(format!("Zahl {number} kann nicht gebunden werden."));
            }
        }
        Json::String(text) => SqlValue::Text(text.clone()),
        other => return Err(format!("Parametertyp wird nicht unterstützt: {other}")),
    })
}

fn from_sql_value(value: ValueRef<'_>) -> Result<Json, String> {
    Ok(match value {
        ValueRef::Null => Json::Null,
        ValueRef::Integer(int) => Json::Number(Number::from(int)),
        ValueRef::Real(float) => Number::from_f64(float).map(Json::Number).unwrap_or(Json::Null),
        ValueRef::Text(text) => Json::String(
            String::from_utf8(text.to_vec()).map_err(|error| error.to_string())?,
        ),
        ValueRef::Blob(_) => return Err("BLOB-Spalten werden nicht unterstützt.".into()),
    })
}

/// Resolves `{ "$lastInsertId": n }` placeholders against ids collected so far.
fn resolve_params(params: &[Json], inserted_ids: &[i64]) -> Result<Vec<SqlValue>, String> {
    params
        .iter()
        .map(|param| {
            if let Json::Object(object) = param {
                if let Some(reference) = object.get("$lastInsertId") {
                    let index = reference
                        .as_u64()
                        .ok_or_else(|| "$lastInsertId erwartet einen Index.".to_string())?
                        as usize;
                    let id = inserted_ids.get(index).ok_or_else(|| {
                        format!("$lastInsertId verweist auf Anweisung {index}, die es nicht gibt.")
                    })?;
                    return Ok(SqlValue::Integer(*id));
                }
            }
            to_sql_value(param)
        })
        .collect()
}

fn run_migrations(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS _migrations (
                name TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            )",
        )
        .map_err(|error| error.to_string())?;

    for (name, sql) in MIGRATIONS {
        let applied: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM _migrations WHERE name = ?1",
                [name],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if applied > 0 {
            continue;
        }
        connection
            .execute_batch(&format!("BEGIN; {sql} COMMIT;"))
            .map_err(|error| format!("Migration {name} ist fehlgeschlagen: {error}"))?;
        connection
            .execute(
                "INSERT INTO _migrations (name, applied_at) VALUES (?1, datetime('now'))",
                [name],
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Opens (and if needed creates plus migrates) the tournament database inside
/// the platform specific application data directory.
pub fn init(app: &AppHandle) -> Result<Db, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Kein Datenverzeichnis gefunden: {error}"))?;
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("Datenverzeichnis konnte nicht angelegt werden: {error}"))?;
    let connection = Connection::open(directory.join("tournament.db"))
        .map_err(|error| format!("Datenbank konnte nicht geöffnet werden: {error}"))?;

    // WAL keeps the admin window and the display window readable in parallel,
    // the busy timeout absorbs short write bursts, and foreign keys protect the
    // relationships between teams, rounds and matches.
    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA busy_timeout = 5000;
             PRAGMA foreign_keys = ON;",
        )
        .map_err(|error| error.to_string())?;
    run_migrations(&connection)?;
    Ok(Db(Mutex::new(connection)))
}

#[tauri::command]
pub fn db_select(
    db: State<'_, Db>,
    sql: String,
    params: Vec<Json>,
) -> Result<Vec<Map<String, Json>>, String> {
    let connection = db.0.lock().map_err(|error| error.to_string())?;
    let mut statement = connection.prepare(&sql).map_err(|error| error.to_string())?;
    let columns: Vec<String> = statement
        .column_names()
        .into_iter()
        .map(String::from)
        .collect();
    let values = resolve_params(&params, &[])?;
    let mut rows = statement
        .query(rusqlite::params_from_iter(values))
        .map_err(|error| error.to_string())?;

    let mut result = Vec::new();
    while let Some(row) = rows.next().map_err(|error| error.to_string())? {
        let mut object = Map::new();
        for (index, column) in columns.iter().enumerate() {
            let value = row.get_ref(index).map_err(|error| error.to_string())?;
            object.insert(column.clone(), from_sql_value(value)?);
        }
        result.push(object);
    }
    Ok(result)
}

/// Runs every statement in one transaction. Any error rolls the whole batch
/// back, so a half finished round or schedule can never reach the database.
#[tauri::command]
pub fn db_batch(
    db: State<'_, Db>,
    statements: Vec<Statement>,
) -> Result<Vec<StatementResult>, String> {
    let mut connection = db.0.lock().map_err(|error| error.to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;

    let mut inserted_ids: Vec<i64> = Vec::with_capacity(statements.len());
    let mut results = Vec::with_capacity(statements.len());
    for statement in &statements {
        let values = resolve_params(&statement.params, &inserted_ids)?;
        let rows_affected = transaction
            .execute(&statement.sql, rusqlite::params_from_iter(values))
            .map_err(|error| error.to_string())?;
        let last_insert_id = transaction.last_insert_rowid();
        inserted_ids.push(last_insert_id);
        results.push(StatementResult {
            last_insert_id,
            rows_affected,
        });
    }

    transaction.commit().map_err(|error| error.to_string())?;
    Ok(results)
}
