use crate::db::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::pagination::{PageParams, PagedResult};

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
    pub legacy_id: Option<String>,
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

// ── Helper: read a Member from a libsql Row ───────────────────────────
fn row_to_member(r: &libsql::Row) -> Result<Member, libsql::Error> {
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
        legacy_id: r.get(11)?,
        joined_at: r.get(12)?,
        notes: r.get(13)?,
    })
}

// ── Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_members(
    search: Option<String>,
    status: Option<String>,
    page: i64,      // Add this
    page_size: i64, // Add this
    db: State<'_, DbState>,
) -> Result<PagedResult<Member>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;
    let params = PageParams { page, page_size };

    let search_val = search
        .as_deref()
        .map(|s| format!("%{}%", s))
        .unwrap_or_else(|| "%".to_string());

    let status_filter = status.unwrap_or_else(|| "%".to_string());

    let mut count_row = conn
        .query(
            "SELECT COUNT(*) FROM members 
             WHERE (?1 IS NULL OR name LIKE ?1 OR mobile LIKE ?1 OR legacy_id LIKE ?1) 
               AND status LIKE ?2",
            libsql::params![search_val.clone(), status_filter.clone()],
        )
        .await
        .map_err(|e| e.to_string())?;

    let total: i64 = if let Some(row) = count_row.next().await.map_err(|e| e.to_string())? {
        row.get(0).unwrap_or(0)
    } else {
        0
    };

    let mut rows = conn
        .query(
            "SELECT m.id, m.name, m.mobile, m.address, m.district, m.pin_code,
                    m.membership_type, mt.name as mt_name,
                    m.status, m.skip_until, m.last_donation, m.legacy_id, m.joined_at, m.notes
             FROM members m
             LEFT JOIN membership_types mt ON mt.id = m.membership_type
             WHERE (?1 IS NULL OR m.name LIKE ?1 OR m.mobile LIKE ?1 OR m.legacy_id LIKE ?1)
               AND m.status LIKE ?2
             ORDER BY 
                CASE 
                    WHEN m.legacy_id LIKE ?1 THEN 1
                    WHEN m.name LIKE ?1 THEN 2
                    ELSE 3
                END ASC,
                m.status ASC,
                m.id DESC
             LIMIT ?3 OFFSET ?4",
            libsql::params![search_val, status_filter, params.limit(), params.offset()],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut members = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        if let Ok(m) = row_to_member(&row) {
            members.push(m);
        }
    }

    // 3. Wrap in PagedResult
    Ok(PagedResult::new(members, total, &params))
}

#[tauri::command]
pub async fn get_member(id: i64, db: State<'_, DbState>) -> Result<Member, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let mut rows = conn
        .query(
            "SELECT m.id, m.name, m.mobile, m.address, m.district, m.pin_code,
                    m.membership_type, mt.name as mt_name,
                    m.status, m.skip_until, m.last_donation, m.legacy_id, m.joined_at, m.notes
             FROM members m
             LEFT JOIN membership_types mt ON mt.id = m.membership_type
             WHERE m.id = ?1",
            libsql::params![id],
        )
        .await
        .map_err(|e| e.to_string())?;

    let row = rows
        .next()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Member not found")?;

    row_to_member(&row).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_member(input: MemberInput, db: State<'_, DbState>) -> Result<i64, String> {
    if input.name.trim().is_empty() {
        return Err("Name is required".to_string());
    }
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute(
        "INSERT INTO members (name, mobile, address, district, pin_code, membership_type, status, skip_until, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        libsql::params![
            input.name.trim().to_string(),
            input.mobile,
            input.address,
            input.district,
            input.pin_code,
            input.membership_type,
            input.status.as_deref().unwrap_or("active").to_string(),
            input.skip_until,
            input.notes,
        ],
    )
    .await
    .map_err(|e| e.to_string())?;

    let mut rows = conn
        .query("SELECT last_insert_rowid()", ())
        .await
        .map_err(|e| e.to_string())?;

    let row = rows
        .next()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Insert failed")?;
    let id: i64 = row.get(0).map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub async fn update_member(
    id: i64,
    input: MemberInput,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if input.name.trim().is_empty() {
        return Err("Name is required".to_string());
    }
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute(
        "UPDATE members SET
            name = ?1, mobile = ?2, address = ?3, district = ?4, pin_code = ?5,
            membership_type = ?6, status = ?7, skip_until = ?8, notes = ?9,
            updated_at = datetime('now')
         WHERE id = ?10",
        libsql::params![
            input.name.trim().to_string(),
            input.mobile,
            input.address,
            input.district,
            input.pin_code,
            input.membership_type,
            input.status.as_deref().unwrap_or("active").to_string(),
            input.skip_until,
            input.notes,
            id,
        ],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_member(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute("DELETE FROM members WHERE id = ?1", libsql::params![id])
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn set_member_status(
    id: i64,
    status: String,
    skip_until: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if !["active", "inactive", "skip"].contains(&status.as_str()) {
        return Err("Invalid status".to_string());
    }
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute(
        "UPDATE members SET status = ?1, skip_until = ?2, updated_at = datetime('now') WHERE id = ?3",
        libsql::params![status, skip_until, id],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn count_members(db: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let total = query_count(conn, "SELECT COUNT(*) FROM members").await?;
    let active = query_count(conn, "SELECT COUNT(*) FROM members WHERE status = 'active'").await?;
    let inactive = query_count(
        conn,
        "SELECT COUNT(*) FROM members WHERE status = 'inactive'",
    )
    .await?;

    Ok(serde_json::json!({ "total": total, "active": active, "inactive": inactive }))
}

#[tauri::command]
pub async fn list_membership_types(
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let mut rows = conn
        .query(
            "SELECT id, name, amount FROM membership_types WHERE is_active = 1 ORDER BY name",
            (),
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        result.push(serde_json::json!({
            "id":     row.get::<i64>(0).unwrap_or(0),
            "name":   row.get::<String>(1).unwrap_or_default(),
            "amount": row.get::<f64>(2).unwrap_or(0.0),
        }));
    }

    Ok(result)
}

#[tauri::command]
pub async fn list_all_membership_types(
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    let mut rows = conn
        .query(
            "SELECT id, name, amount, interval, is_active FROM membership_types ORDER BY id",
            (),
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        result.push(serde_json::json!({
            "id":        row.get::<i64>(0).unwrap_or(0),
            "name":      row.get::<String>(1).unwrap_or_default(),
            "amount":    row.get::<f64>(2).unwrap_or(0.0),
            "interval":  row.get::<Option<String>>(3).unwrap_or(None),
            "is_active": row.get::<i64>(4).unwrap_or(0),
        }));
    }

    Ok(result)
}

#[tauri::command]
pub async fn create_membership_type(
    name: String,
    amount: f64,
    interval: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute(
        "INSERT INTO membership_types (name, amount, interval) VALUES (?1, ?2, ?3)",
        libsql::params![name, amount, interval],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_membership_type(
    id: i64,
    name: String,
    amount: f64,
    interval: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute(
        "UPDATE membership_types SET name = ?1, amount = ?2, interval = ?3 WHERE id = ?4",
        libsql::params![name, amount, interval, id],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_membership_type(
    id: i64,
    is_active: i64,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let lock = db.0.lock().await;
    let inner = lock.as_ref().ok_or("No database open")?;
    let conn = &inner.conn;

    conn.execute(
        "UPDATE membership_types SET is_active = ?1 WHERE id = ?2",
        libsql::params![is_active, id],
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

// Internal helper
async fn query_count(conn: &libsql::Connection, sql: &str) -> Result<i64, String> {
    let mut rows = conn.query(sql, ()).await.map_err(|e| e.to_string())?;
    let row = rows
        .next()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No result")?;
    row.get::<Option<i64>>(0)
        .map_err(|e| e.to_string())
        .map(|v| v.unwrap_or(0))
}
