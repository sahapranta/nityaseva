use crate::db::DbState;
use rusqlite::params;
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

/// Check if any users exist (first run detection)
#[tauri::command]
pub fn has_users(db: State<'_, DbState>) -> Result<bool, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

/// Create the first super-admin (setup wizard)
#[tauri::command]
pub fn create_super_admin(
    name: String,
    mobile: Option<String>,
    passcode: String,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if passcode.len() != 6 || !passcode.chars().all(|c| c.is_ascii_digit()) {
        return Err("Passcode must be exactly 6 digits".to_string());
    }
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    // Only allow if no users exist
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if count > 0 {
        return Err("Setup already complete".to_string());
    }

    conn.execute(
        "INSERT INTO users (name, mobile, passcode, role, status) VALUES (?1, ?2, ?3, 'super_admin', 'active')",
        params![name, mobile, passcode],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Verify PIN and return user info
#[tauri::command]
pub fn verify_pin(passcode: String, db: State<'_, DbState>) -> Result<UserRow, String> {
    if passcode.len() != 6 {
        return Err("Invalid passcode".to_string());
    }
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let result = conn.query_row(
        "SELECT id, name, mobile, role, status FROM users WHERE passcode = ?1 AND status = 'active' LIMIT 1",
        params![passcode],
        |r| {
            Ok(UserRow {
                id: r.get(0)?,
                name: r.get(1)?,
                mobile: r.get(2)?,
                role: r.get(3)?,
                status: r.get(4)?,
            })
        },
    );

    match result {
        Ok(user) => {
            // Update last_login
            conn.execute(
                "UPDATE users SET last_login = datetime('now') WHERE id = ?1",
                params![user.id],
            )
            .ok();
            Ok(user)
        }
        Err(_) => Err("Invalid PIN".to_string()),
    }
}

/// Create a new user (admin/operator) — only admin+ can do this
#[tauri::command]
pub fn create_user(
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
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    // Check passcode not already in use
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE passcode = ?1",
            params![passcode],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists > 0 {
        return Err("Passcode already in use".to_string());
    }

    conn.execute(
        "INSERT INTO users (name, mobile, passcode, role, status) VALUES (?1, ?2, ?3, ?4, 'active')",
        params![name, mobile, passcode, role],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Reset a user's passcode — admin resets operator, super_admin resets admin
#[tauri::command]
pub fn reset_passcode(
    user_id: i64,
    new_passcode: String,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if new_passcode.len() != 6 || !new_passcode.chars().all(|c| c.is_ascii_digit()) {
        return Err("Passcode must be exactly 6 digits".to_string());
    }
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    conn.execute(
        "UPDATE users SET passcode = ?1 WHERE id = ?2",
        params![new_passcode, user_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// List all users (for management screen)
#[tauri::command]
pub fn list_users(db: State<'_, DbState>) -> Result<Vec<UserRow>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare("SELECT id, name, mobile, role, status FROM users ORDER BY id")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok(UserRow {
                id: r.get(0)?,
                name: r.get(1)?,
                mobile: r.get(2)?,
                role: r.get(3)?,
                status: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}