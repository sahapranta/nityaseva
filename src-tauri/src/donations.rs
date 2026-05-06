use crate::db::DbState;
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

fn row_to_donation(r: &libsql::Row) -> Result<Donation, libsql::Error> {
    Ok(Donation {
        id:                 r.get(0)?,
        member_id:          r.get(1)?,
        member_name:        r.get(2)?,
        member_mobile:      r.get(3)?,
        member_address:     r.get(4)?,
        donation_type:      r.get(5)?,
        donation_type_name: r.get(6)?,
        amount:             r.get(7)?,
        paid_for:           r.get(8)?,
        collected_by:       r.get(9)?,
        collected_by_name:  r.get(10)?,
        slip_no:            r.get(11)?,
        note:               r.get(12)?,
        donated_at:         r.get(13)?,
    })
}

const DONATION_SELECT: &str = "
    SELECT d.id, d.member_id, m.name, m.mobile, m.address,
           d.donation_type, dt.name,
           d.amount, d.paid_for, d.collected_by, u.name,
           d.slip_no, d.note, d.donated_at
    FROM donations d
    JOIN members m ON m.id = d.member_id
    LEFT JOIN donation_types dt ON dt.id = d.donation_type
    LEFT JOIN users u ON u.id = d.collected_by";

#[tauri::command]
pub async fn list_donations(
    search: Option<String>,
    donation_type: Option<i64>,
    from_date: Option<String>,
    to_date: Option<String>,
    member_id: Option<i64>,
    db: State<'_, DbState>,
) -> Result<Vec<Donation>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let search_val = search
        .as_deref()
        .map(|s| format!("%{}%", s))
        .unwrap_or_else(|| "%".to_string());

    let from = from_date.unwrap_or_else(|| "1970-01-01".to_string());
    let to   = to_date.unwrap_or_else(|| "9999-12-31".to_string());

    let sql = format!(
        "{} WHERE (m.name LIKE ?1 OR m.mobile LIKE ?1)
           AND (?2 IS NULL OR d.donation_type = ?2)
           AND (?3 IS NULL OR d.member_id = ?3)
           AND date(d.donated_at) >= date(?4)
           AND date(d.donated_at) <= date(?5)
         ORDER BY d.donated_at DESC",
        DONATION_SELECT
    );

    let mut rows = conn
        .query(&sql, libsql::params![search_val, donation_type, member_id, from, to])
        .await
        .map_err(|e| e.to_string())?;

    let mut donations = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        if let Ok(d) = row_to_donation(&row) {
            donations.push(d);
        }
    }

    Ok(donations)
}

#[tauri::command]
pub async fn get_donation(id: i64, db: State<'_, DbState>) -> Result<Donation, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let sql = format!("{} WHERE d.id = ?1", DONATION_SELECT);

    let mut rows = conn
        .query(&sql, libsql::params![id])
        .await
        .map_err(|e| e.to_string())?;

    let row = rows
        .next()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Donation not found")?;

    row_to_donation(&row).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_donation(
    input: DonationInput,
    db: State<'_, DbState>,
) -> Result<i64, String> {
    if input.amount <= 0.0 {
        return Err("Amount must be greater than zero".to_string());
    }

    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let date_prefix = chrono::Local::now().format("%Y%m%d").to_string();

    conn.execute(
        "INSERT INTO donations (member_id, donation_type, amount, paid_for, collected_by, slip_no, note, donated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, COALESCE(?8, datetime('now')))",
        libsql::params![
            input.member_id,
            input.donation_type,
            input.amount,
            input.paid_for.clone(),
            input.collected_by,
            input.slip_no.clone(),
            input.note.clone(),
            input.donated_at.clone(),
        ],
    )
    .await
    .map_err(|e| e.to_string())?;

    // Get new id
    let mut id_rows = conn
        .query("SELECT last_insert_rowid()", ())
        .await
        .map_err(|e| e.to_string())?;
    let id_row = id_rows.next().await.map_err(|e| e.to_string())?.ok_or("Insert failed")?;
    let new_id: i64 = id_row.get(0).map_err(|e| e.to_string())?;

    // Auto-generate slip_no if not provided
    if input.slip_no.is_none() {
        let slip = format!("{}-{}", date_prefix, new_id);
        conn.execute(
            "UPDATE donations SET slip_no = ?1 WHERE id = ?2",
            libsql::params![slip, new_id],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    // Update member last_donation
    conn.execute(
        "UPDATE members SET last_donation = COALESCE(?1, datetime('now')), updated_at = datetime('now') WHERE id = ?2",
        libsql::params![input.donated_at, input.member_id],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(new_id)
}

#[tauri::command]
pub async fn update_donation(
    id: i64,
    input: DonationInput,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if input.amount <= 0.0 {
        return Err("Amount must be greater than zero".to_string());
    }

    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute(
        "UPDATE donations SET
            member_id = ?1, donation_type = ?2, amount = ?3, paid_for = ?4,
            collected_by = ?5, slip_no = ?6, note = ?7,
            donated_at = COALESCE(?8, donated_at)
         WHERE id = ?9",
        libsql::params![
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
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_donation(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute("DELETE FROM donations WHERE id = ?1", libsql::params![id])
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn list_donation_types(db: State<'_, DbState>) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let mut rows = conn
        .query("SELECT id, name FROM donation_types WHERE is_active = 1 ORDER BY id", ())
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        result.push(serde_json::json!({
            "id":   row.get::<i64>(0).unwrap_or(0),
            "name": row.get::<String>(1).unwrap_or_default(),
        }));
    }

    Ok(result)
}

#[tauri::command]
pub async fn list_all_donation_types(db: State<'_, DbState>) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let mut rows = conn
        .query("SELECT id, name, is_active FROM donation_types ORDER BY id", ())
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        result.push(serde_json::json!({
            "id":        row.get::<i64>(0).unwrap_or(0),
            "name":      row.get::<String>(1).unwrap_or_default(),
            "is_active": row.get::<i64>(2).unwrap_or(0),
        }));
    }

    Ok(result)
}

#[tauri::command]
pub async fn create_donation_type(name: String, db: State<'_, DbState>) -> Result<(), String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute(
        "INSERT INTO donation_types (name) VALUES (?1)",
        libsql::params![name],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_donation_type(
    id: i64,
    name: String,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute(
        "UPDATE donation_types SET name = ?1 WHERE id = ?2",
        libsql::params![name, id],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_donation_type(
    id: i64,
    is_active: i64,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute(
        "UPDATE donation_types SET is_active = ?1 WHERE id = ?2",
        libsql::params![is_active, id],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn donation_summary(
    from_date: Option<String>,
    to_date: Option<String>,
    db: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let from = from_date.unwrap_or_else(|| "1970-01-01".to_string());
    let to   = to_date.unwrap_or_else(|| "9999-12-31".to_string());

    let mut total_rows = conn
        .query(
            "SELECT COALESCE(SUM(amount), 0) FROM donations
             WHERE date(donated_at) BETWEEN date(?1) AND date(?2)",
            libsql::params![from.clone(), to.clone()],
        )
        .await
        .map_err(|e| e.to_string())?;
    let total_row = total_rows.next().await.map_err(|e| e.to_string())?.ok_or("No result")?;
    let total: f64 = total_row.get(0).map_err(|e| e.to_string())?;

    let mut count_rows = conn
        .query(
            "SELECT COUNT(*) FROM donations
             WHERE date(donated_at) BETWEEN date(?1) AND date(?2)",
            libsql::params![from, to],
        )
        .await
        .map_err(|e| e.to_string())?;
    let count_row = count_rows.next().await.map_err(|e| e.to_string())?.ok_or("No result")?;
    let count: i64 = count_row.get(0).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "total": total, "count": count }))
}