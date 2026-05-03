use crate::db::DbState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Member {
    pub id: i64,
    pub name: String,
    pub mobile: Option<String>,
    pub address: Option<String>,
    pub district: Option<String>,
    pub pin_code: Option<String>,
    pub membership_type: Option<i64>,
    pub membership_type_name: Option<String>,
    pub status: String,
    pub skip_until: Option<String>,
    pub last_donation: Option<String>,
    pub joined_at: String,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MemberInput {
    pub name: String,
    pub mobile: Option<String>,
    pub address: Option<String>,
    pub district: Option<String>,
    pub pin_code: Option<String>,
    pub membership_type: Option<i64>,
    pub status: Option<String>,
    pub skip_until: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn list_members(
    search: Option<String>,
    status: Option<String>,
    db: State<'_, DbState>,
) -> Result<Vec<Member>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let search_val = search
        .as_deref()
        .map(|s| format!("%{}%", s))
        .unwrap_or_else(|| "%".to_string());

    let status_filter = status.as_deref().unwrap_or("%");

    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.name, m.mobile, m.address, m.district, m.pin_code,
                    m.membership_type, mt.name as mt_name,
                    m.status, m.skip_until, m.last_donation, m.joined_at, m.notes
             FROM members m
             LEFT JOIN membership_types mt ON mt.id = m.membership_type
             WHERE (m.name LIKE ?1 OR m.mobile LIKE ?1)
               AND m.status LIKE ?2
             ORDER BY m.name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![search_val, status_filter], |r| {
            Ok(Member {
                id: r.get(0)?,
                name: r.get(1)?,
                mobile: r.get(2)?,
                address: r.get(3)?,
                district: r.get(4)?,
                pin_code: r.get(5)?,
                membership_type: r.get(6)?,
                membership_type_name: r.get(7)?,
                status: r.get(8)?,
                skip_until: r.get(9)?,
                last_donation: r.get(10)?,
                joined_at: r.get(11)?,
                notes: r.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[tauri::command]
pub fn get_member(id: i64, db: State<'_, DbState>) -> Result<Member, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    conn.query_row(
        "SELECT m.id, m.name, m.mobile, m.address, m.district, m.pin_code,
                m.membership_type, mt.name as mt_name,
                m.status, m.skip_until, m.last_donation, m.joined_at, m.notes
         FROM members m
         LEFT JOIN membership_types mt ON mt.id = m.membership_type
         WHERE m.id = ?1",
        params![id],
        |r| {
            Ok(Member {
                id: r.get(0)?,
                name: r.get(1)?,
                mobile: r.get(2)?,
                address: r.get(3)?,
                district: r.get(4)?,
                pin_code: r.get(5)?,
                membership_type: r.get(6)?,
                membership_type_name: r.get(7)?,
                status: r.get(8)?,
                skip_until: r.get(9)?,
                last_donation: r.get(10)?,
                joined_at: r.get(11)?,
                notes: r.get(12)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_member(input: MemberInput, db: State<'_, DbState>) -> Result<i64, String> {
    if input.name.trim().is_empty() {
        return Err("Name is required".to_string());
    }
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    conn.execute(
        "INSERT INTO members (name, mobile, address, district, pin_code, membership_type, status, skip_until, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            input.name.trim(),
            input.mobile,
            input.address,
            input.district,
            input.pin_code,
            input.membership_type,
            input.status.as_deref().unwrap_or("active"),
            input.skip_until,
            input.notes,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_member(
    id: i64,
    input: MemberInput,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if input.name.trim().is_empty() {
        return Err("Name is required".to_string());
    }
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    conn.execute(
        "UPDATE members SET
            name = ?1, mobile = ?2, address = ?3, district = ?4, pin_code = ?5,
            membership_type = ?6, status = ?7, skip_until = ?8, notes = ?9,
            updated_at = datetime('now')
         WHERE id = ?10",
        params![
            input.name.trim(),
            input.mobile,
            input.address,
            input.district,
            input.pin_code,
            input.membership_type,
            input.status.as_deref().unwrap_or("active"),
            input.skip_until,
            input.notes,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_member(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    conn.execute("DELETE FROM members WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn set_member_status(
    id: i64,
    status: String,
    skip_until: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if !["active", "inactive", "skip"].contains(&status.as_str()) {
        return Err("Invalid status".to_string());
    }
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    conn.execute(
        "UPDATE members SET status = ?1, skip_until = ?2, updated_at = datetime('now') WHERE id = ?3",
        params![status, skip_until, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn count_members(db: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM members", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let active: i64 = conn
        .query_row("SELECT COUNT(*) FROM members WHERE status = 'active'", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let inactive: i64 = conn
        .query_row("SELECT COUNT(*) FROM members WHERE status = 'inactive'", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "total": total, "active": active, "inactive": inactive }))
}

// Add this to the bottom of members.rs

#[tauri::command]
pub fn list_membership_types(db: State<'_, DbState>) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare("SELECT id, name, amount FROM membership_types WHERE is_active = 1 ORDER BY name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok(serde_json::json!({
                "id": r.get::<_, i64>(0)?,
                "name": r.get::<_, String>(1)?,
                "amount": r.get::<_, f64>(2)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[tauri::command]
pub fn list_all_membership_types(db: State<'_, DbState>) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;
    let mut stmt = conn
        .prepare("SELECT id, name, amount, interval, is_active FROM membership_types ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok(serde_json::json!({
            "id": r.get::<_,i64>(0)?,
            "name": r.get::<_,String>(1)?,
            "amount": r.get::<_,f64>(2)?,
            "interval": r.get::<_,Option<String>>(3)?,
            "is_active": r.get::<_,i64>(4)?,
        })))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn create_membership_type(
    name: String, amount: f64, interval: Option<String>, db: State<'_, DbState>,
) -> Result<(), String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;
    conn.execute(
        "INSERT INTO membership_types (name, amount, interval) VALUES (?1, ?2, ?3)",
        params![name, amount, interval],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_membership_type(
    id: i64, name: String, amount: f64, interval: Option<String>, db: State<'_, DbState>,
) -> Result<(), String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;
    conn.execute(
        "UPDATE membership_types SET name=?1, amount=?2, interval=?3 WHERE id=?4",
        params![name, amount, interval, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_membership_type(id: i64, is_active: i64, db: State<'_, DbState>) -> Result<(), String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;
    conn.execute("UPDATE membership_types SET is_active=?1 WHERE id=?2", params![is_active, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}