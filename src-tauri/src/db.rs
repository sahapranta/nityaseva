use rusqlite::{Connection, Result as SqlResult};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DbState(pub Mutex<Option<Connection>>);

/// Run all migrations — creates tables if they don't exist
pub fn run_migrations(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    conn.execute_batch("
        -- Users (auth)
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

        -- Organisation settings (key-value)
        CREATE TABLE IF NOT EXISTS org_settings (
            key         TEXT PRIMARY KEY,
            value       TEXT
        );

        -- Membership types (configurable from Settings)
        CREATE TABLE IF NOT EXISTS membership_types (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            amount      REAL NOT NULL DEFAULT 0,
            interval    TEXT,        -- monthly, yearly, lifetime, etc.
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Donation types (configurable from Settings)
        CREATE TABLE IF NOT EXISTS donation_types (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,  -- Monthly, Festival, Voluntary, etc.
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Members
        CREATE TABLE IF NOT EXISTS members (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            mobile          TEXT,
            address         TEXT,
            district        TEXT,
            pin_code        TEXT,
            membership_type INTEGER REFERENCES membership_types(id),
            status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','skip')),
            skip_until      TEXT,        -- date: skip magazine until
            last_donation   TEXT,        -- date: last donation date
            joined_at       TEXT NOT NULL DEFAULT (datetime('now')),
            notes           TEXT,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Donations
        CREATE TABLE IF NOT EXISTS donations (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id       INTEGER NOT NULL REFERENCES members(id),
            donation_type   INTEGER REFERENCES donation_types(id),
            amount          REAL NOT NULL,
            paid_for        TEXT,        -- e.g. 'May 2026' or 'Durga Puja 2026'
            collected_by    INTEGER REFERENCES users(id),
            slip_no         TEXT,
            note            TEXT,
            donated_at      TEXT NOT NULL DEFAULT (datetime('now')),
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Receipts (tracks printed slips)
        CREATE TABLE IF NOT EXISTS receipts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            donation_id     INTEGER NOT NULL REFERENCES donations(id),
            printed_at      TEXT NOT NULL DEFAULT (datetime('now')),
            printed_by      INTEGER REFERENCES users(id)
        );

        -- Indexes for fast search
        CREATE INDEX IF NOT EXISTS idx_members_name    ON members(name);
        CREATE INDEX IF NOT EXISTS idx_members_mobile  ON members(mobile);
        CREATE INDEX IF NOT EXISTS idx_members_status  ON members(status);
        CREATE INDEX IF NOT EXISTS idx_donations_member ON donations(member_id);
        CREATE INDEX IF NOT EXISTS idx_donations_date   ON donations(donated_at);
    ")?;

    // Seed default donation types if empty
    conn.execute_batch("
        INSERT OR IGNORE INTO donation_types (id, name) VALUES
            (1, 'Monthly'),
            (2, 'Tri-Monthly'),
            (3, 'Half-Yearly'),
            (4, 'Yearly'),
            (5, 'Festival'),
            (6, 'Voluntary');
    ")?;

    conn.execute_batch("
        INSERT OR IGNORE INTO membership_types (id, name, amount, interval) VALUES
            (1, 'General', 200.0, 'yearly'),
            (2, 'Life Member', 1000.0, 'lifetime');
    ")?;

    Ok(())
}

/// Open (or create) the database at the given path and run migrations
pub fn open_db(path: PathBuf) -> SqlResult<Connection> {
    let conn = Connection::open(&path)?;
    run_migrations(&conn)?;
    Ok(conn)
}