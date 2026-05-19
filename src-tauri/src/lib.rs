mod auth;
mod crypto;
mod db;
mod donations;
mod member_export;
mod members;
mod reports;
mod settings;
mod turso;
mod pagination;

use auth::*;
use db::DbState;
use donations::*;
use member_export::*;
use members::*;
use reports::*;
use settings::*;
use turso::*;

use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
struct SetupState {
    frontend_task: bool,
    backend_task: bool,
}

#[tauri::command]
async fn set_complete(
    app: AppHandle,
    state: tauri::State<'_, Arc<Mutex<SetupState>>>,
    task: String,
) -> Result<(), ()> {
    let mut state_lock = state.lock().unwrap();
    match task.as_str() {
        "frontend" => state_lock.frontend_task = true,
        "backend" => state_lock.backend_task = true,
        _ => panic!("invalid task completed!"),
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

/// Returns "ok" | "no_replica" | "no_credentials"
/// Frontend uses this to decide whether to show setup screen
#[tauri::command]
async fn get_db_init_status(db: tauri::State<'_, DbState>) -> Result<String, String> {
    let lock = db.0.lock().await;
    if lock.is_some() {
        Ok("ok".to_string())
    } else {
        Ok("no_credentials".to_string())
    }
}

async fn setup(app: AppHandle) -> Result<(), ()> {
    println!("Backend setup starting…");

    let db = app.state::<DbState>();

    match turso_open_from_saved(&app, &db).await {
        Ok(_) => println!("Database opened successfully"),
        Err(e) => println!("DB open result: {} (will show setup if needed)", e),
    }

    set_complete(
        app.clone(),
        app.state::<Arc<Mutex<SetupState>>>(),
        "backend".to_string(),
    )
    .await?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ── Single instance ─────────────────────────────────────────
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When a second instance tries to launch, focus the existing window
            if let Some(window) = app.get_webview_window("main") {
                window.show().ok();
                window.set_focus().ok();
                window.unminimize().ok();
            }
        }))
        // ── Other plugins ────────────────────────────────────────────
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // ── State ────────────────────────────────────────────────────
        .manage(Arc::new(Mutex::new(SetupState {
            frontend_task: false,
            backend_task: false,
        })))
        .manage(DbState::new())
        // ── Commands ─────────────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            set_complete,
            get_db_init_status,
            turso_ever_configured,
            // turso
            turso_is_configured,
            turso_setup,
            turso_sync,
            turso_status,
            turso_update_credentials,
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
            list_donations,
            get_donation,
            create_donation,
            create_donations_batch,
            update_donation,
            delete_donation,
            list_donation_types,
            list_all_donation_types,
            create_donation_type,
            update_donation_type,
            toggle_donation_type,
            donation_summary,
            count_donations,
            // settings
            get_org_settings,
            set_org_setting,
            set_org_settings,
            get_db_path,
            backup_database,
            // reports
            report_donation_collection,
            report_top_donors,
            report_frequent_donors,
            report_monthly_summary,
            report_collection_by_donated_at,
            // export
            export_members_csv,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                setup(handle).await.ok();
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
