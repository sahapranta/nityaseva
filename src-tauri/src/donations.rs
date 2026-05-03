use crate::db::DbState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Donation {
    pub id: i64,
    pub member_id: i64,
    pub member_name: String,
    pub member_mobile: Option<String>,
    pub member_address: Option<String>,
    pub donation_type: Option<i64>,
    pub donation_type_name: Option<String>,
    pub amount: f64,
    pub paid_for: Option<String>,
    pub collected_by: Option<i64>,
    pub collected_by_name: Option<String>,
    pub slip_no: Option<String>,
    pub note: Option<String>,
    pub donated_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DonationInput {
    pub member_id: i64,
    pub donation_type: Option<i64>,
    pub amount: f64,
    pub paid_for: Option<String>,
    pub collected_by: Option<i64>,
    pub slip_no: Option<String>,
    pub note: Option<String>,
    pub donated_at: Option<String>,
}

#[tauri::command]
pub fn list_donations(
    search: Option<String>,
    donation_type: Option<i64>,
    from_date: Option<String>,
    to_date: Option<String>,
    member_id: Option<i64>,
    db: State<'_, DbState>,
) -> Result<Vec<Donation>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let search_val = search
        .as_deref()
        .map(|s| format!("%{}%", s))
        .unwrap_or_else(|| "%".to_string());

    let from = from_date.as_deref().unwrap_or("1970-01-01");
    let to = to_date.as_deref().unwrap_or("9999-12-31");

    let mut stmt = conn
        .prepare(
            "SELECT d.id, d.member_id, m.name, m.mobile, m.address,
                    d.donation_type, dt.name,
                    d.amount, d.paid_for, d.collected_by, u.name,
                    d.slip_no, d.note, d.donated_at
             FROM donations d
             JOIN members m ON m.id = d.member_id
             LEFT JOIN donation_types dt ON dt.id = d.donation_type
             LEFT JOIN users u ON u.id = d.collected_by
             WHERE (m.name LIKE ?1 OR m.mobile LIKE ?1)
               AND (?2 IS NULL OR d.donation_type = ?2)
               AND (?3 IS NULL OR d.member_id = ?3)
               AND date(d.donated_at) >= date(?4)
               AND date(d.donated_at) <= date(?5)
             ORDER BY d.donated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(
            params![search_val, donation_type, member_id, from, to],
            |r| {
                Ok(Donation {
                    id: r.get(0)?,
                    member_id: r.get(1)?,
                    member_name: r.get(2)?,
                    member_mobile: r.get(3)?,
                    member_address: r.get(4)?,
                    donation_type: r.get(5)?,
                    donation_type_name: r.get(6)?,
                    amount: r.get(7)?,
                    paid_for: r.get(8)?,
                    collected_by: r.get(9)?,
                    collected_by_name: r.get(10)?,
                    slip_no: r.get(11)?,
                    note: r.get(12)?,
                    donated_at: r.get(13)?,
                })
            },
        )
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[tauri::command]
pub fn get_donation(id: i64, db: State<'_, DbState>) -> Result<Donation, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    conn.query_row(
        "SELECT d.id, d.member_id, m.name, m.mobile, m.address,
                d.donation_type, dt.name,
                d.amount, d.paid_for, d.collected_by, u.name,
                d.slip_no, d.note, d.donated_at
         FROM donations d
         JOIN members m ON m.id = d.member_id
         LEFT JOIN donation_types dt ON dt.id = d.donation_type
         LEFT JOIN users u ON u.id = d.collected_by
         WHERE d.id = ?1",
        params![id],
        |r| {
            Ok(Donation {
                id: r.get(0)?,
                member_id: r.get(1)?,
                member_name: r.get(2)?,
                member_mobile: r.get(3)?,
                member_address: r.get(4)?,
                donation_type: r.get(5)?,
                donation_type_name: r.get(6)?,
                amount: r.get(7)?,
                paid_for: r.get(8)?,
                collected_by: r.get(9)?,
                collected_by_name: r.get(10)?,
                slip_no: r.get(11)?,
                note: r.get(12)?,
                donated_at: r.get(13)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_donation(
    input: DonationInput,
    db: State<'_, DbState>,
) -> Result<i64, String> {
    if input.amount <= 0.0 {
        return Err("Amount must be greater than zero".to_string());
    }
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let _donated_at = input
        .donated_at
        .as_deref()
        .unwrap_or("datetime('now')");

    // Generate slip_no if not provided: YYYYMMDD-{id}
    let date_prefix = chrono::Local::now().format("%Y%m%d").to_string();

    conn.execute(
        "INSERT INTO donations (member_id, donation_type, amount, paid_for, collected_by, slip_no, note, donated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, COALESCE(?8, datetime('now')))",
        params![
            input.member_id,
            input.donation_type,
            input.amount,
            input.paid_for,
            input.collected_by,
            input.slip_no,
            input.note,
            input.donated_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    let new_id = conn.last_insert_rowid();

    // Set slip_no = YYYYMMDD-{id} if not provided
    if input.slip_no.is_none() {
        let slip = format!("{}-{}", date_prefix, new_id);
        conn.execute(
            "UPDATE donations SET slip_no = ?1 WHERE id = ?2",
            params![slip, new_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Update member last_donation date
    conn.execute(
        "UPDATE members SET last_donation = COALESCE(?1, datetime('now')), updated_at = datetime('now') WHERE id = ?2",
        params![input.donated_at, input.member_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(new_id)
}

#[tauri::command]
pub fn update_donation(
    id: i64,
    input: DonationInput,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if input.amount <= 0.0 {
        return Err("Amount must be greater than zero".to_string());
    }
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    conn.execute(
        "UPDATE donations SET
            member_id = ?1, donation_type = ?2, amount = ?3, paid_for = ?4,
            collected_by = ?5, slip_no = ?6, note = ?7,
            donated_at = COALESCE(?8, donated_at)
         WHERE id = ?9",
        params![
            input.member_id,
            input.donation_type,
            input.amount,
            input.paid_for,
            input.collected_by,
            input.slip_no,
            input.note,
            input.donated_at,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_donation(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;
    conn.execute("DELETE FROM donations WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_donation_types(db: State<'_, DbState>) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare("SELECT id, name FROM donation_types WHERE is_active = 1 ORDER BY id")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok(serde_json::json!({
                "id": r.get::<_, i64>(0)?,
                "name": r.get::<_, String>(1)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[tauri::command]
pub fn donation_summary(
    from_date: Option<String>,
    to_date: Option<String>,
    db: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let from = from_date.as_deref().unwrap_or("1970-01-01");
    let to = to_date.as_deref().unwrap_or("9999-12-31");

    let total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM donations WHERE date(donated_at) BETWEEN date(?1) AND date(?2)",
            params![from, to],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM donations WHERE date(donated_at) BETWEEN date(?1) AND date(?2)",
            params![from, to],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "total": total, "count": count }))
}


#[tauri::command]
pub fn list_all_donation_types(db: State<'_, DbState>) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;
    let mut stmt = conn
        .prepare("SELECT id, name, is_active FROM donation_types ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok(serde_json::json!({
            "id": r.get::<_,i64>(0)?,
            "name": r.get::<_,String>(1)?,
            "is_active": r.get::<_,i64>(2)?,
        })))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn create_donation_type(name: String, db: State<'_, DbState>) -> Result<(), String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;
    conn.execute("INSERT INTO donation_types (name) VALUES (?1)", params![name])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_donation_type(id: i64, name: String, db: State<'_, DbState>) -> Result<(), String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;
    conn.execute("UPDATE donation_types SET name=?1 WHERE id=?2", params![name, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_donation_type(id: i64, is_active: i64, db: State<'_, DbState>) -> Result<(), String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;
    conn.execute("UPDATE donation_types SET is_active=?1 WHERE id=?2", params![is_active, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
