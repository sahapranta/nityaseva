use crate::db::DbState;
use tauri::State;

#[tauri::command]
pub async fn export_members_csv(
    status: Option<String>,
    eligible: Option<String>,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let status_filter = status.unwrap_or_else(|| "%".to_string());

    let eligible_join = if eligible.is_some() {
        "JOIN donations d ON d.member_id = m.id AND d.paid_for_period = ?2"
    } else {
        ""
    };

    // 2. Inject the join clause using format!
    let select_sql = format!(
        "SELECT m.id, m.name, m.mobile, m.address, m.district, m.pin_code,
                mt.name as membership_type, m.status,
                m.last_donation, m.joined_at, m.notes
         FROM members m
         LEFT JOIN membership_types mt ON mt.id = m.membership_type
         {eligible_join}
         WHERE m.status LIKE ?1
         GROUP BY m.id
         ORDER BY m.id DESC"
    );

    // 3. Bind the parameters dynamically depending on whether eligible is provided
    let mut rows = if let Some(ref period) = eligible {
        conn.query(&select_sql, libsql::params![status_filter, period.clone()])
            .await
            .map_err(|e| e.to_string())?
    } else {
        conn.query(&select_sql, libsql::params![status_filter])
            .await
            .map_err(|e| e.to_string())?
    };

    let mut result = Vec::new();

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        result.push(serde_json::json!({
            "id":              row.get::<i64>(0).unwrap_or_default(),
            "name":            row.get::<String>(1).unwrap_or_default(),
            "mobile":          row.get::<Option<String>>(2).unwrap_or_default(),
            "address":         row.get::<Option<String>>(3).unwrap_or_default(),
            "district":        row.get::<Option<String>>(4).unwrap_or_default(),
            "pin_code":        row.get::<Option<String>>(5).unwrap_or_default(),
            "membership_type": row.get::<Option<String>>(6).unwrap_or_default(),
            "status":          row.get::<String>(7).unwrap_or_default(),
            "last_donation":   row.get::<Option<String>>(8).unwrap_or_default(),
            "joined_at":       row.get::<String>(9).unwrap_or_default(),
            "notes":           row.get::<Option<String>>(10).unwrap_or_default(),
        }));
    }

    Ok(result)
}