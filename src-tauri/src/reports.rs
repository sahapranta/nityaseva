use crate::db::DbState;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn report_donation_collection(
    from_date: String,
    to_date: String,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare(
            "SELECT d.id, d.slip_no, m.name, m.mobile, m.address,
                    dt.name as type_name, d.amount, d.paid_for,
                    d.donated_at, u.name as collected_by
             FROM donations d
             JOIN members m ON m.id = d.member_id
             LEFT JOIN donation_types dt ON dt.id = d.donation_type
             LEFT JOIN users u ON u.id = d.collected_by
             WHERE date(d.donated_at) BETWEEN date(?1) AND date(?2)
             ORDER BY d.donated_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![from_date, to_date], |r| {
            Ok(serde_json::json!({
                "id": r.get::<_,i64>(0)?,
                "slip_no": r.get::<_,Option<String>>(1)?,
                "member_name": r.get::<_,String>(2)?,
                "mobile": r.get::<_,Option<String>>(3)?,
                "address": r.get::<_,Option<String>>(4)?,
                "donation_type": r.get::<_,Option<String>>(5)?,
                "amount": r.get::<_,f64>(6)?,
                "paid_for": r.get::<_,Option<String>>(7)?,
                "donated_at": r.get::<_,String>(8)?,
                "collected_by": r.get::<_,Option<String>>(9)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[tauri::command]
pub fn report_top_donors(
    from_date: Option<String>,
    to_date: Option<String>,
    limit: Option<i64>,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let from = from_date.as_deref().unwrap_or("1970-01-01");
    let to = to_date.as_deref().unwrap_or("9999-12-31");
    let lim = limit.unwrap_or(20);

    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.name, m.mobile,
                    COUNT(d.id) as donation_count,
                    SUM(d.amount) as total_amount,
                    MAX(d.donated_at) as last_donation
             FROM donations d
             JOIN members m ON m.id = d.member_id
             WHERE date(d.donated_at) BETWEEN date(?1) AND date(?2)
             GROUP BY m.id
             ORDER BY total_amount DESC
             LIMIT ?3",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![from, to, lim], |r| {
            Ok(serde_json::json!({
                "member_id": r.get::<_,i64>(0)?,
                "name": r.get::<_,String>(1)?,
                "mobile": r.get::<_,Option<String>>(2)?,
                "donation_count": r.get::<_,i64>(3)?,
                "total_amount": r.get::<_,f64>(4)?,
                "last_donation": r.get::<_,String>(5)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[tauri::command]
pub fn report_frequent_donors(
    from_date: Option<String>,
    to_date: Option<String>,
    limit: Option<i64>,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let from = from_date.as_deref().unwrap_or("1970-01-01");
    let to = to_date.as_deref().unwrap_or("9999-12-31");
    let lim = limit.unwrap_or(20);

    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.name, m.mobile,
                    COUNT(d.id) as donation_count,
                    SUM(d.amount) as total_amount,
                    MAX(d.donated_at) as last_donation
             FROM donations d
             JOIN members m ON m.id = d.member_id
             WHERE date(d.donated_at) BETWEEN date(?1) AND date(?2)
             GROUP BY m.id
             ORDER BY donation_count DESC, total_amount DESC
             LIMIT ?3",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![from, to, lim], |r| {
            Ok(serde_json::json!({
                "member_id": r.get::<_,i64>(0)?,
                "name": r.get::<_,String>(1)?,
                "mobile": r.get::<_,Option<String>>(2)?,
                "donation_count": r.get::<_,i64>(3)?,
                "total_amount": r.get::<_,f64>(4)?,
                "last_donation": r.get::<_,String>(5)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

#[tauri::command]
pub fn report_monthly_summary(
    year: i32,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    let mut stmt = conn
        .prepare(
            "SELECT strftime('%m', donated_at) as month,
                    COUNT(*) as count,
                    SUM(amount) as total
             FROM donations
             WHERE strftime('%Y', donated_at) = ?1
             GROUP BY month
             ORDER BY month ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![year.to_string()], |r| {
            Ok(serde_json::json!({
                "month": r.get::<_,String>(0)?,
                "count": r.get::<_,i64>(1)?,
                "total": r.get::<_,f64>(2)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}