use crate::db::DbState;
use std::{collections::HashMap, fs};
use tauri::{State, AppHandle, Manager};

/// Get all org settings as a key-value map
#[tauri::command]
pub async fn get_org_settings(db: State<'_, DbState>) -> Result<HashMap<String, String>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let mut rows = conn
        .query("SELECT key, value FROM org_settings", ())
        .await
        .map_err(|e| e.to_string())?;

    let mut map = HashMap::new();

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        let key: String = row.get(0).unwrap_or_default();
        let value: String = row.get(1).unwrap_or_default();
        // don't expose turso credentials to frontend
        if !key.starts_with("turso_") {
            map.insert(key, value);
        }
    }

    Ok(map)
}

/// Set a single org setting
#[tauri::command]
pub async fn set_org_setting(
    key: String,
    value: String,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute(
        "INSERT INTO org_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, value],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Set multiple org settings
#[tauri::command]
pub async fn set_org_settings(
    settings: HashMap<String, String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    for (key, value) in settings {
        conn.execute(
            "INSERT INTO org_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [key, value],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn backup_database(dest_path: String, db: State<'_, DbState>) -> Result<(), String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;

    // WAL checkpoint then copy the replica file
    inner
        .conn
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .await
        .map_err(|e| e.to_string())?;

    fs::copy(&inner._replica_path, &dest_path).map_err(|e| format!("Backup failed: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_db_path(app: AppHandle) -> String {
    app.path()
        .app_data_dir()
        .map(|d| d.join("nityaseva-replica.db").to_string_lossy().to_string())
        .unwrap_or_else(|_| "Unknown".to_string())
}