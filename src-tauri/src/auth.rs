use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserRow {
    pub id: i64,
    pub name: String,
    pub mobile: Option<String>,
    pub role: String,
    pub status: String,
}

fn row_to_user(r: &libsql::Row) -> Result<UserRow, libsql::Error> {
    Ok(UserRow {
        id:     r.get(0)?,
        name:   r.get(1)?,
        mobile: r.get(2)?,
        role:   r.get(3)?,
        status: r.get(4)?,
    })
}

/// Check if any users exist (first run detection)
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

/// Create the first super-admin (setup wizard)
#[tauri::command]
pub async fn create_super_admin(
    name: String,
    mobile: Option<String>,
    passcode: String,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if passcode.len() != 6 || !passcode.chars().all(|c| c.is_ascii_digit()) {
        return Err("Passcode must be exactly 6 digits".to_string());
    }

    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    // Only allow if no users exist
    let mut rows = conn
        .query("SELECT COUNT(*) FROM users", ())
        .await
        .map_err(|e| e.to_string())?;
    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or("No result")?;
    let count: i64 = row.get(0).map_err(|e| e.to_string())?;
    if count > 0 {
        return Err("Setup already complete".to_string());
    }

    conn.execute(
        "INSERT INTO users (name, mobile, passcode, role, status)
         VALUES (?1, ?2, ?3, 'super_admin', 'active')",
        libsql::params![name, mobile, passcode],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Verify PIN and return user info
#[tauri::command]
pub async fn verify_pin(passcode: String, db: State<'_, DbState>) -> Result<UserRow, String> {
    if passcode.len() != 6 {
        return Err("Invalid passcode".to_string());
    }

    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let mut rows = conn
        .query(
            "SELECT id, name, mobile, role, status FROM users
             WHERE passcode = ?1 AND status = 'active' LIMIT 1",
            libsql::params![passcode],
        )
        .await
        .map_err(|e| e.to_string())?;

    let row = rows
        .next()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Invalid PIN")?;

    let user = row_to_user(&row).map_err(|e| e.to_string())?;

    // Update last_login (non-fatal)
    conn.execute(
        "UPDATE users SET last_login = datetime('now') WHERE id = ?1",
        libsql::params![user.id],
    )
    .await
    .ok();

    Ok(user)
}

/// Create a new user — admin/operator only
#[tauri::command]
pub async fn create_user(
    name: String,
    mobile: Option<String>,
    passcode: String,
    role: String,
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

    // Check passcode not already in use
    let mut rows = conn
        .query(
            "SELECT COUNT(*) FROM users WHERE passcode = ?1",
            libsql::params![passcode.clone()],
        )
        .await
        .map_err(|e| e.to_string())?;
    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or("No result")?;
    let exists: i64 = row.get(0).map_err(|e| e.to_string())?;
    if exists > 0 {
        return Err("Passcode already in use".to_string());
    }

    conn.execute(
        "INSERT INTO users (name, mobile, passcode, role, status)
         VALUES (?1, ?2, ?3, ?4, 'active')",
        libsql::params![name, mobile, passcode, role],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Reset a user's passcode
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

    conn.execute(
        "UPDATE users SET passcode = ?1 WHERE id = ?2",
        libsql::params![new_passcode, user_id],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// List all users
#[tauri::command]
pub async fn list_users(db: State<'_, DbState>) -> Result<Vec<UserRow>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let mut rows = conn
        .query(
            "SELECT id, name, mobile, role, status FROM users ORDER BY id",
            (),
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut users = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        if let Ok(u) = row_to_user(&row) {
            users.push(u);
        }
    }

    Ok(users)
}