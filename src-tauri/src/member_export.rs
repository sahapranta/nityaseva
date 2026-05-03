use crate::db::DbState;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn export_members_csv(
    status: Option<String>,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let status_filter = status.as_deref().unwrap_or("%");

    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.name, m.mobile, m.address, m.district, m.pin_code,
                    mt.name as membership_type, m.status,
                    m.last_donation, m.joined_at, m.notes
             FROM members m
             LEFT JOIN membership_types mt ON mt.id = m.membership_type
             WHERE m.status LIKE ?1
             ORDER BY m.name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![status_filter], |r| {
            Ok(serde_json::json!({
                "id":              r.get::<_,i64>(0)?,
                "name":            r.get::<_,String>(1)?,
                "mobile":          r.get::<_,Option<String>>(2)?,
                "address":         r.get::<_,Option<String>>(3)?,
                "district":        r.get::<_,Option<String>>(4)?,
                "pin_code":        r.get::<_,Option<String>>(5)?,
                "membership_type": r.get::<_,Option<String>>(6)?,
                "status":          r.get::<_,String>(7)?,
                "last_donation":   r.get::<_,Option<String>>(8)?,
                "joined_at":       r.get::<_,String>(9)?,
                "notes":           r.get::<_,Option<String>>(10)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}