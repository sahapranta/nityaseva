use crate::crypto::{decrypt, encrypt};
use crate::db::DbState;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Serialize, Debug, Clone)]
pub struct SyncStatus {
    pub connected: bool,
    pub last_synced: Option<String>,
    pub message: String,
}

// ── Helpers
fn get_replica_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| {
            std::fs::create_dir_all(&d).ok();
            d.join("nityaseva-replica.db")
        })
        .map_err(|e| e.to_string())
}

pub fn get_app_data_path(app: &AppHandle) -> String {
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
        Some(encrypted) => {
            // Handle migration: if value is not encrypted, return as-is
            if !crate::crypto::is_encrypted(&encrypted) {
                return Ok(Some(encrypted));
            }
            Ok(Some(decrypt(&encrypted, app_data_path)?))
        }
        None => Ok(None),
    }
}

// ── Open local replica offline (no sync)
async fn open_local_only(replica_path: &PathBuf) -> Result<libsql::Connection, String> {
    let db = libsql::Builder::new_local(replica_path.to_str().ok_or("Invalid path")?)
        .build()
        .await
        .map_err(|e| e.to_string())?;

    db.connect().map_err(|e| e.to_string())
}

// ── Commands
/// Check if Turso credentials are saved
#[tauri::command]
pub async fn turso_is_configured(db: State<'_, DbState>) -> Result<bool, String> {
    let lock = db.0.lock().await;
    if let Some(inner) = lock.as_ref() {
        let result = get_setting(&inner.conn, "turso_url").await?;
        return Ok(result.is_some());
    }
    Ok(false)
}

/// First-time setup — validate credentials, open replica, save encrypted
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

    let db_built = libsql::Builder::new_remote_replica(
        replica_path.to_str().ok_or("Invalid path")?,
        url.trim().to_string(),
        auth_token.trim().to_string(),
    )
    .build()
    .await
    .map_err(|e| format!("Failed to connect: {}", e))?;

    db_built
        .sync()
        .await
        .map_err(|e| format!("Initial sync failed: {}", e))?;

    let conn = db_built.connect().map_err(|e| e.to_string())?;
    crate::db::run_migrations(&conn).await?;

    let inner = crate::db::DbInner {
        db: db_built,
        conn,
        _replica_path: replica_path,
        turso_url: Some(url.trim().to_string()),
        turso_token: Some(auth_token.trim().to_string()),
    };

    save_encrypted(&inner.conn, "turso_url", url.trim(), &app_data_path).await?;
    save_encrypted(
        &inner.conn,
        "turso_token",
        auth_token.trim(),
        &app_data_path,
    )
    .await?;

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

/// Called on app launch — opens replica using saved credentials
/// Works offline: opens local replica first, syncs only if internet available
pub async fn turso_open_from_saved(app: &AppHandle, db: &DbState) -> Result<(), String> {
    let replica_path = get_replica_path(app)?;
    let app_data_path = get_app_data_path(app);

    println!("Replica path: {:?}", replica_path);

    if !replica_path.exists() {
        return Err("no_replica".to_string());
    }

    // Step 1: Open local-only to read credentials
    let local_conn = open_local_only(&replica_path).await?;

    // Run migrations on local DB first
    crate::db::run_migrations(&local_conn).await?;

    let url = load_decrypted(&local_conn, "turso_url", &app_data_path).await?;
    let token = load_decrypted(&local_conn, "turso_token", &app_data_path).await?;

    // We drop the connection here so the file isn't locked if we need to delete it
    drop(local_conn);

    match (url, token) {
        (Some(u), Some(t)) => {
            // Open LOCAL only — no network needed
            let local_db = libsql::Builder::new_local(replica_path.to_str().ok_or("Invalid path")?)
                .build()
                .await
                .map_err(|e| format!("Failed to open local db: {}", e))?;

            let conn = local_db.connect().map_err(|e| e.to_string())?;
            crate::db::run_migrations(&conn).await?;

            let inner = crate::db::DbInner {
                db: local_db,
                conn,
                _replica_path: replica_path,
                turso_url: Some(u),   // store for later sync
                turso_token: Some(t), // store for later sync
            };

            let mut lock = db.0.lock().await;
            *lock = Some(inner);

            println!("Database opened locally (offline-first)");
            Ok(())
        }
        _ => Err("no_credentials".to_string()),
    }
}

/// Manual or post-login sync — non-fatal, returns status
#[tauri::command]
pub async fn turso_sync(app: AppHandle, db: State<'_, DbState>) -> Result<SyncStatus, String> {
    let mut lock = db.0.lock().await;
    let inner = lock.as_mut().ok_or("No database open")?;

    // Get stored credentials
    let url = match &inner.turso_url {
        Some(u) => u.clone(),
        None => {
            return Ok(SyncStatus {
                connected: false,
                last_synced: None,
                message: "No Turso credentials stored".to_string(),
            })
        }
    };
    let token = match &inner.turso_token {
        Some(t) => t.clone(),
        None => {
            return Ok(SyncStatus {
                connected: false,
                last_synced: None,
                message: "No Turso credentials stored".to_string(),
            })
        }
    };

    // Rebuild as remote replica for sync
    let replica_path = inner._replica_path.clone();

    // Drop conn temporarily
    drop(lock);

    let sync_result = async {
        let remote_db = libsql::Builder::new_remote_replica(
            replica_path.to_str().ok_or("Invalid path")?,
            url.clone(),
            token.clone(),
        )
        .build()
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

        remote_db.sync().await.map_err(|e| e.to_string())?;

        Ok::<_, String>(remote_db)
    }
    .await;

    let mut lock = db.0.lock().await;
    let inner = lock.as_mut().ok_or("No database open")?;

    match sync_result {
        Ok(remote_db) => {
            // Swap to remote replica connection
            let new_conn = remote_db.connect().map_err(|e| e.to_string())?;
            inner.db = remote_db;
            inner.conn = new_conn;

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

            app.emit(
                "sync-status",
                SyncStatus {
                    connected: true,
                    last_synced: Some(display.clone()),
                    message: format!("Synced at {}", display),
                },
            )
            .ok();

            Ok(SyncStatus {
                connected: true,
                last_synced: Some(display.clone()),
                message: format!("Synced at {}", display),
            })
        }
        Err(e) => {
            let status = SyncStatus {
                connected: false,
                last_synced: None,
                message: format!("Sync failed: {}", e),
            };
            app.emit("sync-status", status.clone()).ok();
            Ok(status)
        }
    }
}

/// Get last sync status without syncing
#[tauri::command]
pub async fn turso_status(db: State<'_, DbState>) -> Result<SyncStatus, String> {
    let lock = db.0.lock().await;

    if lock.is_none() {
        return Ok(SyncStatus {
            connected: false,
            last_synced: None,
            message: "not_configured".to_string(),
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

/// Update credentials
#[tauri::command]
pub async fn turso_update_credentials(
    url: String,
    auth_token: String,
    app: AppHandle,
    db: State<'_, DbState>,
) -> Result<(), String> {
    turso_setup(url, auth_token, app, db).await
}

#[tauri::command]
pub async fn turso_ever_configured(app: AppHandle) -> Result<bool, String> {
    let replica_path = get_replica_path(&app)?;
    Ok(replica_path.exists())
}
