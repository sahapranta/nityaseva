use crate::db::DbState;
use tauri::State;

#[tauri::command]
pub async fn report_donation_collection(
    from_date: String,
    to_date: String,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let mut rows = conn
        .query(
            "SELECT d.id, d.slip_no, m.name, m.mobile, m.address,
                    dt.name, d.amount, d.paid_for,
                    d.donated_at, u.name
             FROM donations d
             JOIN members m ON m.id = d.member_id
             LEFT JOIN donation_types dt ON dt.id = d.donation_type
             LEFT JOIN users u ON u.id = d.collected_by
             WHERE COALESCE(
                     d.paid_for_period || '-01',
                     date(d.donated_at)
                   ) BETWEEN date(?1) AND date(?2)
             ORDER BY d.paid_for_period DESC NULLS LAST",
            [from_date, to_date],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        result.push(serde_json::json!({
            "id": row.get::<i64>(0).unwrap_or_default(),
            "slip_no": row.get::<Option<String>>(1).unwrap_or(None),
            "member_name": row.get::<String>(2).unwrap_or_default(),
            "mobile": row.get::<Option<String>>(3).ok(),
            "address": row.get::<Option<String>>(4).ok(),
            "donation_type": row.get::<Option<String>>(5).ok(),
            "amount": row.get::<f64>(6).unwrap_or(0.0),
            "paid_for": row.get::<Option<String>>(7).ok(),
            "donated_at": row.get::<String>(8).unwrap_or_default(),
            "collected_by": row.get::<Option<String>>(9).ok(),
        }));
    }

    Ok(result)
}

#[tauri::command]
pub async fn report_top_donors(
    from_date: Option<String>,
    to_date: Option<String>,
    limit: Option<i64>,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let from = from_date.unwrap_or("1970-01-01".into());
    let to = to_date.unwrap_or("9999-12-31".into());
    let lim = limit.unwrap_or(20);

    let mut rows = conn
        .query(
            "SELECT m.id, m.name, m.mobile,
                    COUNT(d.id),
                    SUM(d.amount),
                    MAX(d.donated_at)
             FROM donations d
             JOIN members m ON m.id = d.member_id
             WHERE date(d.donated_at) BETWEEN date(?1) AND date(?2)
             GROUP BY m.id
             ORDER BY SUM(d.amount) DESC
             LIMIT ?3",
            [from, to, lim.to_string()],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        result.push(serde_json::json!({
            "member_id": row.get::<i64>(0).unwrap_or_default(),
            "name": row.get::<String>(1).unwrap_or_default(),
            "mobile": row.get::<Option<String>>(2).ok(),
            "donation_count": row.get::<i64>(3).unwrap_or(0),
            "total_amount": row.get::<f64>(4).unwrap_or(0.0),
            "last_donation": row.get::<String>(5).unwrap_or_default(),
        }));
    }

    Ok(result)
}

#[tauri::command]
pub async fn report_frequent_donors(
    from_date: Option<String>,
    to_date: Option<String>,
    limit: Option<i64>,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let from = from_date.unwrap_or("1970-01-01".into());
    let to = to_date.unwrap_or("9999-12-31".into());
    let lim = limit.unwrap_or(20);

    let mut rows = conn
        .query(
            "SELECT m.id, m.name, m.mobile,
                    COUNT(d.id),
                    SUM(d.amount),
                    MAX(d.donated_at)
             FROM donations d
             JOIN members m ON m.id = d.member_id
             WHERE date(d.donated_at) BETWEEN date(?1) AND date(?2)
             GROUP BY m.id
             ORDER BY COUNT(d.id) DESC, SUM(d.amount) DESC
             LIMIT ?3",
            [from, to, lim.to_string()],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        result.push(serde_json::json!({
            "member_id": row.get::<i64>(0).unwrap_or_default(),
            "name": row.get::<String>(1).unwrap_or_default(),
            "mobile": row.get::<Option<String>>(2).ok(),
            "donation_count": row.get::<i64>(3).unwrap_or(0),
            "total_amount": row.get::<f64>(4).unwrap_or(0.0),
            "last_donation": row.get::<String>(5).unwrap_or_default(),
        }));
    }

    Ok(result)
}

#[tauri::command]
pub async fn report_monthly_summary(
    year: i32,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let year_str = year.to_string();
    let start_period = format!("{}-01", year_str); // e.g., "2026-01"
    let end_period = format!("{}-12", year_str); // e.g., "2026-12"

    let mut rows = conn
        .query(
            "SELECT 
            -- Extract the month from our resolved YYYY-MM string
            SUBSTR(COALESCE(paid_for_period, strftime('%Y-%m', donated_at)), 6, 2) as month,
            COUNT(*),
            SUM(amount)
         FROM donations
         WHERE 
            -- Check if the resolved YYYY-MM period falls within the target year
            COALESCE(paid_for_period, strftime('%Y-%m', donated_at)) BETWEEN ?1 AND ?2
         GROUP BY month
         ORDER BY month ASC",
            libsql::params![start_period, end_period],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        result.push(serde_json::json!({
            "month": row.get::<String>(0).unwrap_or_default(),
            "count": row.get::<i64>(1).unwrap_or(0),
            "total": row.get::<f64>(2).unwrap_or(0.0),
        }));
    }

    Ok(result)
}
