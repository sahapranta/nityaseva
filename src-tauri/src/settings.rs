use crate::db::DbState;
use rusqlite::params;
use std::collections::HashMap;
use tauri::State;

/// Get all org settings as a key-value map
#[tauri::command]
pub fn get_org_settings(db: State<'_, DbState>) -> Result<HashMap<String, String>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare("SELECT key, value FROM org_settings")
        .map_err(|e| e.to_string())?;

    let map = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(map)
}

/// Set a single org setting
#[tauri::command]
pub fn set_org_setting(
    key: String,
    value: String,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    conn.execute(
        "INSERT INTO org_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Set multiple org settings at once
#[tauri::command]
pub fn set_org_settings(
    settings: HashMap<String, String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    for (key, value) in settings {
        conn.execute(
            "INSERT INTO org_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

