use libsql::{Builder, Connection, Database};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct DbState(pub Arc<Mutex<Option<DbInner>>>);

pub struct DbInner {
    pub db: Database,
    pub conn: Connection,
    pub _replica_path: PathBuf,
}

impl DbState {
    pub fn new() -> Self {
        DbState(Arc::new(Mutex::new(None)))
    }
}

/// Open embedded replica — works offline, syncs to Turso when credentials provided
pub async fn open_embedded_replica(
    replica_path: PathBuf,
    url: String,
    auth_token: String,
) -> Result<DbInner, String> {
    std::fs::create_dir_all(replica_path.parent().unwrap()).map_err(|e| e.to_string())?;

    let db = Builder::new_remote_replica(
        replica_path.to_str().unwrap(),
        url,
        auth_token,
    )
    .build()
    .await
    .map_err(|e| format!("Failed to open database: {}", e))?;

    // Initial sync on open
    db.sync().await.map_err(|e| format!("Initial sync failed: {}", e))?;

    let conn = db.connect().map_err(|e| e.to_string())?;

    run_migrations(&conn).await?;

    Ok(DbInner { db, conn, _replica_path: replica_path })
}

/// Run all migrations
pub async fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .await
        .map_err(|e| e.to_string())?;

    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .await
        .map_err(|e| e.to_string())?;

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            mobile      TEXT,
            passcode    TEXT NOT NULL,
            role        TEXT NOT NULL CHECK(role IN ('super_admin','admin','operator')),
            status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
            last_login  TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS org_settings (
            key         TEXT PRIMARY KEY,
            value       TEXT
        );

        CREATE TABLE IF NOT EXISTS membership_types (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            amount      REAL NOT NULL DEFAULT 0,
            interval    TEXT,
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS donation_types (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS members (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            mobile          TEXT,
            address         TEXT,
            district        TEXT,
            pin_code        TEXT,
            membership_type INTEGER REFERENCES membership_types(id),
            status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','skip')),
            skip_until      TEXT,
            last_donation   TEXT,
            joined_at       TEXT NOT NULL DEFAULT (datetime('now')),
            notes           TEXT,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS donations (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id       INTEGER NOT NULL REFERENCES members(id),
            donation_type   INTEGER REFERENCES donation_types(id),
            amount          REAL NOT NULL,
            paid_for        TEXT,
            collected_by    INTEGER REFERENCES users(id),
            slip_no         TEXT,
            note            TEXT,
            donated_at      TEXT NOT NULL DEFAULT (datetime('now')),
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS receipts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            donation_id     INTEGER NOT NULL REFERENCES donations(id),
            printed_at      TEXT NOT NULL DEFAULT (datetime('now')),
            printed_by      INTEGER REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_members_name     ON members(name);
        CREATE INDEX IF NOT EXISTS idx_members_mobile   ON members(mobile);
        CREATE INDEX IF NOT EXISTS idx_members_status   ON members(status);
        CREATE INDEX IF NOT EXISTS idx_donations_member ON donations(member_id);
        CREATE INDEX IF NOT EXISTS idx_donations_date   ON donations(donated_at);
    ")
    .await
    .map_err(|e| e.to_string())?;

    // Seed donation types
    conn.execute_batch("
        INSERT OR IGNORE INTO donation_types (id, name) VALUES
            (1, 'Monthly'),
            (2, 'Tri-Monthly'),
            (3, 'Half-Yearly'),
            (4, 'Yearly'),
            (5, 'Festival'),
            (6, 'Voluntary');
    ")
    .await
    .map_err(|e| e.to_string())?;

    // Seed membership types
    conn.execute_batch("
        INSERT OR IGNORE INTO membership_types (id, name, amount, interval) VALUES
            (1, 'General', 100.0, 'yearly'),
            (2, 'Life Member', 1000.0, 'lifetime');
    ")
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}