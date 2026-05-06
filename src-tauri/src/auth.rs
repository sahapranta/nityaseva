use crate::crypto::{
    decrypt, encrypt, hash_passcode, is_bcrypt_hash, is_encrypted, verify_passcode,
};
use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserRow {
    pub id: i64,
    pub name: String,
    pub mobile: Option<String>,
    pub role: String,
    pub status: String,
}

// ── Helpers ───────────────────────────────────────────────────────────

fn get_app_data_path(app: &AppHandle) -> String {
    app.path()
        .app_data_dir()
        .map(|d| d.to_string_lossy().to_string())
        .unwrap_or_else(|_| "nityaseva".to_string())
}

/// Decrypt mobile if encrypted, return as-is if plaintext
fn maybe_decrypt(value: Option<String>, app_data_path: &str) -> Option<String> {
    value.map(|v| {
        if is_encrypted(&v) {
            decrypt(&v, app_data_path).unwrap_or(v)
        } else {
            v
        }
    })
}

/// Decrypt role — always encrypted at rest
fn decrypt_role(value: String, app_data_path: &str) -> String {
    if is_encrypted(&value) {
        decrypt(&value, app_data_path).unwrap_or(value)
    } else {
        value // plaintext fallback for migration
    }
}

/// Build a UserRow from a libsql Row, decrypting sensitive fields
fn row_to_user(r: &libsql::Row, app_data_path: &str) -> Result<UserRow, libsql::Error> {
    let id: i64          = r.get(0)?;
    let name: String     = r.get(1)?;
    let mobile: Option<String> = r.get(2)?;
    let role: String     = r.get(3)?;
    let status: String   = r.get(4)?;

    Ok(UserRow {
        id,
        name,
        mobile: maybe_decrypt(mobile, app_data_path),
        role: decrypt_role(role, app_data_path),
        status,
    })
}

// ── Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn has_users(db: State<'_, DbState>) -> Result<bool, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let mut rows = conn
        .query("SELECT COUNT(*) FROM users", ())
        .await
        .map_err(|e| e.to_string())?;

    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or("No result")?;
    let count: i64 = row.get(0).map_err(|e| e.to_string())?;

    Ok(count > 0)
}

#[tauri::command]
pub async fn create_super_admin(
    name: String,
    mobile: Option<String>,
    passcode: String,
    app: AppHandle,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if passcode.len() != 6 || !passcode.chars().all(|c| c.is_ascii_digit()) {
        return Err("Passcode must be exactly 6 digits".to_string());
    }

    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;
    let app_data_path = get_app_data_path(&app);

    // Only allow if no users exist
    let mut rows = conn.query("SELECT COUNT(*) FROM users", ()).await.map_err(|e| e.to_string())?;
    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or("No result")?;
    let count: i64 = row.get(0).map_err(|e| e.to_string())?;
    if count > 0 {
        return Err("Setup already complete".to_string());
    }

    let hashed_passcode = hash_passcode(&passcode)?;
    let encrypted_role  = encrypt("super_admin", &app_data_path)?;
    let encrypted_mobile = mobile
        .as_deref()
        .map(|m| encrypt(m, &app_data_path))
        .transpose()?;

    conn.execute(
        "INSERT INTO users (name, mobile, passcode, role, status)
         VALUES (?1, ?2, ?3, ?4, 'active')",
        libsql::params![name, encrypted_mobile, hashed_passcode, encrypted_role],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn verify_pin(
    passcode: String,
    app: AppHandle,
    db: State<'_, DbState>,
) -> Result<UserRow, String> {
    if passcode.len() != 6 {
        return Err("Invalid passcode".to_string());
    }

    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;
    let app_data_path = get_app_data_path(&app);

    // Fetch all active users and verify bcrypt in Rust
    // (can't do bcrypt comparison in SQL)
    let mut rows = conn
        .query(
            "SELECT id, name, mobile, role, status, passcode FROM users WHERE status = 'active'",
            (),
        )
        .await
        .map_err(|e| e.to_string())?;

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        let stored_passcode: String = row.get(5).map_err(|e| e.to_string())?;

        let matches = if is_bcrypt_hash(&stored_passcode) {
            verify_passcode(&passcode, &stored_passcode)
        } else {
            // Plain passcode — migrate on the fly
            stored_passcode == passcode
        };

        if matches {
            // Migrate plain passcode to bcrypt if needed
            if !is_bcrypt_hash(&stored_passcode) {
                let hashed = hash_passcode(&passcode)?;
                let id: i64 = row.get(0).map_err(|e| e.to_string())?;
                conn.execute(
                    "UPDATE users SET passcode = ?1 WHERE id = ?2",
                    libsql::params![hashed, id],
                )
                .await
                .ok();
            }

            let user = row_to_user(&row, &app_data_path).map_err(|e| e.to_string())?;

            // Update last_login
            conn.execute(
                "UPDATE users SET last_login = datetime('now') WHERE id = ?1",
                libsql::params![user.id],
            )
            .await
            .ok();

            return Ok(user);
        }
    }

    Err("Invalid PIN".to_string())
}

#[tauri::command]
pub async fn create_user(
    name: String,
    mobile: Option<String>,
    passcode: String,
    role: String,
    app: AppHandle,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if passcode.len() != 6 || !passcode.chars().all(|c| c.is_ascii_digit()) {
        return Err("Passcode must be exactly 6 digits".to_string());
    }
    if !["admin", "operator"].contains(&role.as_str()) {
        return Err("Invalid role".to_string());
    }

    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;
    let app_data_path = get_app_data_path(&app);

    // Check passcode uniqueness by fetching all and verifying bcrypt
    let mut rows = conn
        .query("SELECT passcode FROM users", ())
        .await
        .map_err(|e| e.to_string())?;

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        let stored: String = row.get(0).map_err(|e| e.to_string())?;
        let matches = if is_bcrypt_hash(&stored) {
            verify_passcode(&passcode, &stored)
        } else {
            stored == passcode
        };
        if matches {
            return Err("Passcode already in use".to_string());
        }
    }

    let hashed_passcode  = hash_passcode(&passcode)?;
    let encrypted_role   = encrypt(&role, &app_data_path)?;
    let encrypted_mobile = mobile
        .as_deref()
        .map(|m| encrypt(m, &app_data_path))
        .transpose()?;

    conn.execute(
        "INSERT INTO users (name, mobile, passcode, role, status)
         VALUES (?1, ?2, ?3, ?4, 'active')",
        libsql::params![name, encrypted_mobile, hashed_passcode, encrypted_role],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn reset_passcode(
    user_id: i64,
    new_passcode: String,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if new_passcode.len() != 6 || !new_passcode.chars().all(|c| c.is_ascii_digit()) {
        return Err("Passcode must be exactly 6 digits".to_string());
    }

    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let hashed = hash_passcode(&new_passcode)?;

    conn.execute(
        "UPDATE users SET passcode = ?1 WHERE id = ?2",
        libsql::params![hashed, user_id],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn list_users(
    app: AppHandle,
    db: State<'_, DbState>,
) -> Result<Vec<UserRow>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;
    let app_data_path = get_app_data_path(&app);

    let mut rows = conn
        .query(
            "SELECT id, name, mobile, role, status FROM users ORDER BY id",
            (),
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut users = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        if let Ok(u) = row_to_user(&row, &app_data_path) {
            users.push(u);
        }
    }

    Ok(users)
}