use crate::crypto::{decrypt, encrypt};
use crate::db::{open_embedded_replica, DbState};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

#[derive(Serialize, Debug)]
pub struct SyncStatus {
    pub connected: bool,
    pub last_synced: Option<String>,
    pub message: String,
}

// ── Helpers ───────────────────────────────────────────────────────────

fn get_replica_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("nityaseva-replica.db"))
        .map_err(|e| e.to_string())
}

fn get_app_data_path(app: &AppHandle) -> String {
    app.path()
        .app_data_dir()
        .map(|d| d.to_string_lossy().to_string())
        .unwrap_or_else(|_| "nityaseva".to_string())
}

async fn get_setting(conn: &libsql::Connection, key: &str) -> Result<Option<String>, String> {
    let mut rows = conn
        .query("SELECT value FROM org_settings WHERE key = ?1", [key])
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        Ok(Some(row.get::<String>(0).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

async fn save_encrypted(
    conn: &libsql::Connection,
    key: &str,
    value: &str,
    app_data_path: &str,
) -> Result<(), String> {
    let encrypted = encrypt(value, app_data_path)?;
    conn.execute(
        "INSERT INTO org_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, encrypted.as_str()],
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

async fn load_decrypted(
    conn: &libsql::Connection,
    key: &str,
    app_data_path: &str,
) -> Result<Option<String>, String> {
    match get_setting(conn, key).await? {
        Some(encrypted) => Ok(Some(decrypt(&encrypted, app_data_path)?)),
        None => Ok(None),
    }
}

// ── Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn turso_is_configured(db: State<'_, DbState>) -> Result<bool, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let result = get_setting(&inner.conn, "turso_url").await?;
    Ok(result.is_some())
}

#[tauri::command]
pub async fn turso_setup(
    url: String,
    auth_token: String,
    app: AppHandle,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if url.trim().is_empty() || auth_token.trim().is_empty() {
        return Err("URL and auth token are required".to_string());
    }

    let replica_path = get_replica_path(&app)?;
    let app_data_path = get_app_data_path(&app);

    let inner = open_embedded_replica(
        replica_path,
        url.trim().to_string(),
        auth_token.trim().to_string(),
    )
    .await?;

    // Store credentials encrypted
    save_encrypted(&inner.conn, "turso_url", url.trim(), &app_data_path).await?;
    save_encrypted(&inner.conn, "turso_token", auth_token.trim(), &app_data_path).await?;

    let now = chrono::Local::now().to_rfc3339();
    inner
        .conn
        .execute(
            "INSERT INTO org_settings (key, value) VALUES ('turso_last_synced', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [now],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut lock = db.0.lock().await;
    *lock = Some(inner);

    Ok(())
}

/// Called on app launch — opens replica using saved encrypted credentials
pub async fn turso_open_from_saved(app: &AppHandle, db: &DbState) -> Result<(), String> {
    let replica_path = get_replica_path(app)?;
    let app_data_path = get_app_data_path(app);

    if !replica_path.exists() {
        return Err("No local database found. Please configure Turso in Settings.".to_string());
    }

    // Open local-only to read encrypted credentials
    let local_db = libsql::Builder::new_local(replica_path.to_str().unwrap())
        .build()
        .await
        .map_err(|e| e.to_string())?;
    let local_conn = local_db.connect().map_err(|e| e.to_string())?;

    let url = load_decrypted(&local_conn, "turso_url", &app_data_path)
        .await?
        .ok_or("Turso URL not configured. Please set up Turso in Settings.")?;

    let token = load_decrypted(&local_conn, "turso_token", &app_data_path)
        .await?
        .ok_or("Turso token not configured. Please set up Turso in Settings.")?;

    drop(local_conn);
    drop(local_db);

    // Open as embedded replica
    let inner = open_embedded_replica(replica_path, url, token).await?;

    // Update last synced (non-fatal if offline)
    let now = chrono::Local::now().to_rfc3339();
    inner
        .conn
        .execute(
            "INSERT INTO org_settings (key, value) VALUES ('turso_last_synced', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [now],
        )
        .await
        .ok();

    let mut lock = db.0.lock().await;
    *lock = Some(inner);

    Ok(())
}

#[tauri::command]
pub async fn turso_sync(db: State<'_, DbState>) -> Result<SyncStatus, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;

    match inner.db.sync().await {
        Ok(_) => {
            let now = chrono::Local::now();
            let display = now.format("%d %b %Y, %I:%M %p").to_string();
            inner
                .conn
                .execute(
                    "INSERT INTO org_settings (key, value) VALUES ('turso_last_synced', ?1)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    [now.to_rfc3339()],
                )
                .await
                .ok();
            Ok(SyncStatus {
                connected: true,
                last_synced: Some(display.clone()),
                message: format!("Synced at {}", display),
            })
        }
        Err(e) => Ok(SyncStatus {
            connected: false,
            last_synced: None,
            message: format!("Sync failed: {}", e),
        }),
    }
}

#[tauri::command]
pub async fn turso_status(db: State<'_, DbState>) -> Result<SyncStatus, String> {
    let lock = db.0.lock().await;

    if lock.is_none() {
        return Ok(SyncStatus {
            connected: false,
            last_synced: None,
            message: "Not configured".to_string(),
        });
    }

    let inner = lock.as_ref().unwrap();
    let last_synced = get_setting(&inner.conn, "turso_last_synced")
        .await
        .unwrap_or(None)
        .map(|s| {
            chrono::DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.format("%d %b %Y, %I:%M %p").to_string())
                .unwrap_or(s)
        });

    Ok(SyncStatus {
        connected: true,
        last_synced: last_synced.clone(),
        message: last_synced
            .map(|s| format!("Last synced: {}", s))
            .unwrap_or_else(|| "Never synced".to_string()),
    })
}

#[tauri::command]
pub async fn turso_update_credentials(
    url: String,
    auth_token: String,
    app: AppHandle,
    db: State<'_, DbState>,
) -> Result<(), String> {
    turso_setup(url, auth_token, app, db).await
}