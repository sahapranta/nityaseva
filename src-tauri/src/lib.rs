mod auth;
mod db;
mod donations;
mod members;
mod reports;
mod settings;
mod member_export;

use member_export::*;
use auth::*;
use donations::*;
use members::*;
use reports::*;
use settings::*;

use db::{open_db, DbState};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::async_runtime::spawn;
use tauri::{AppHandle, Manager, State};
use tokio::time::{sleep, Duration};

struct SetupState {
    frontend_task: bool,
    backend_task: bool,
}

// Commands
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "lowercase")]
enum TaskType {
    Frontend,
    Backend,
}

// Setup
#[tauri::command]
async fn set_complete(
    app: AppHandle,
    state: State<'_, Mutex<SetupState>>,
    task: TaskType,
) -> Result<(), String> {
    let mut state_lock = state.lock().map_err(|_| "State is poisoned".to_string())?;
    match task {
        TaskType::Frontend => state_lock.frontend_task = true,
        TaskType::Backend => state_lock.backend_task = true
    }
    if state_lock.backend_task && state_lock.frontend_task {
        if let Some(splash) = app.get_webview_window("splashscreen") {
            splash.close().unwrap();
        }
        if let Some(main) = app.get_webview_window("main") {
            main.show().unwrap();
        }
    }
    Ok(())
}

async fn setup(app: AppHandle) -> Result<(), String> {
    println!("Performing backend setup...");

    // Try to open the default db from app data dir
    if let Ok(data_dir) = app.path().app_data_dir() {
        std::fs::create_dir_all(&data_dir).ok();
        let default_db = data_dir.join("nityaseva.db");
        let db_state = app.state::<DbState>();
        if let Ok(conn) = open_db(default_db.clone()) {
            let mut lock = db_state.0.lock().unwrap();
            *lock = Some(conn);
            println!("Default database opened: {:?}", default_db);
        }
    }

    sleep(Duration::from_secs(1)).await;
    println!("Backend setup complete!");

    set_complete(
        app.clone(),
        app.state::<Mutex<SetupState>>(),
        TaskType::Backend,
    )
    .await?;
    Ok(())
}

#[tauri::command]
fn get_db_path(app: AppHandle) -> String {
    if let Ok(data_dir) = app.path().app_data_dir() {
        return data_dir.join("nityaseva.db").to_string_lossy().to_string();
    }
    "Unknown".to_string()
}

/// Called from React: open or create a .db file
#[tauri::command]
fn open_database(path: String, db: State<'_, DbState>) -> Result<String, String> {
    let path = PathBuf::from(&path);
    match open_db(path) {
        Ok(conn) => {
            let mut lock = db.0.lock().unwrap();
            *lock = Some(conn);
            Ok("Database opened successfully".to_string())
        }
        Err(e) => Err(format!("Failed to open database: {}", e)),
    }
}

/// Check if a database is currently loaded
#[tauri::command]
fn db_status(db: State<'_, DbState>) -> bool {
    db.0.lock().unwrap().is_some()
}

#[tauri::command]
fn backup_database(dest_path: String, db: State<'_, DbState>) -> Result<(), String> {
    let lock = db.0.lock().unwrap();
    let conn = lock.as_ref().ok_or("No database open")?;

    // WAL checkpoint before backup
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| e.to_string())?;

    // Get current db path and copy the file
    let db_path = conn.path().ok_or("Cannot determine database path")?;
    std::fs::copy(db_path, &dest_path).map_err(|e| e.to_string())?;

    Ok(())
}

// Entry point
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Mutex::new(SetupState {
            frontend_task: false,
            backend_task: false,
        }))
        .manage(DbState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            greet,
            set_complete,
            open_database,
            db_status,
            // auth
            has_users,
            create_super_admin,
            verify_pin,
            create_user,
            reset_passcode,
            list_users,
            // members
            list_members,
            get_member,
            create_member,
            update_member,
            delete_member,
            set_member_status,
            count_members,
            list_membership_types,
            list_all_membership_types,
            create_membership_type,
            update_membership_type,
            toggle_membership_type,
            // donations
            list_all_donation_types,
            create_donation_type,
            update_donation_type,
            toggle_donation_type,
            list_donations,
            create_donation,
            delete_donation,
            donation_summary,
            get_donation,
            update_donation,
            list_donation_types,
            get_db_path,
            backup_database,
            // settings
            get_org_settings,
            set_org_setting,
            set_org_settings,
            // reports
            report_donation_collection,
            report_top_donors,
            report_frequent_donors,
            report_monthly_summary,
            // member export
            export_members_csv,
        ])
        .setup(|app| {
            spawn(setup(app.handle().clone()));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
