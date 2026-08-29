mod commands;
mod db;
mod domain;
mod error;
mod import;

use db::Db;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Il database sta nella cartella dati dell'app: sopravvive agli
            // aggiornamenti e resta al riparo dai file di progetto.
            let dir = app.path().app_data_dir()?;
            let db = Db::open(&dir.join("segna-asta.db"))?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::import_player_list,
            commands::player_lists,
            commands::latest_player_list,
            commands::players,
            commands::teams,
            commands::create_auction,
            commands::auctions,
            commands::auction,
            commands::managers,
            commands::assign_player,
            commands::undo_last_pick,
            commands::picks,
            commands::auction_state,
            commands::active_auction_id,
            commands::set_active_auction,
            commands::save_wish,
            commands::remove_wish,
            commands::move_wish,
            commands::wishlist,
            commands::budget_plan,
            commands::set_budget_plan,
        ])
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio dell'applicazione");
}
