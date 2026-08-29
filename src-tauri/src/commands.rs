//! I comandi esposti al frontend. Ognuno prende il lock sulla connessione,
//! fa il suo lavoro e lo rilascia: nessuno stato resta appeso fra una
//! chiamata e l'altra.

use crate::db::queries::{self, NewAuction, PlayerFilter, WishInput};
use crate::db::Db;
use crate::domain::{
    Auction, AuctionState, BudgetPlanEntry, Manager, Pick, PickDetail, Player, PlayerList,
    WishEntry,
};
use crate::error::{AppError, Result};
use crate::import;
use crate::backup;
use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager as _;
use tauri::{AppHandle, State};

/// Cosa è entrato nel database dopo un import, per darne conto a chi guarda.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub list: PlayerList,
    pub by_role: Vec<RoleCount>,
    pub team_count: usize,
    pub total_quotation: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleCount {
    pub role: crate::domain::Role,
    pub count: usize,
}

#[tauri::command]
pub fn import_player_list(
    db: State<'_, Db>,
    path: String,
    label: Option<String>,
) -> Result<ImportReport> {
    let path = PathBuf::from(path);
    let players = import::read_listone(&path)?;

    let source_file = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    let label = label
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .unwrap_or_else(|| source_file.clone());

    let total_quotation = players.iter().map(|p| p.quotation).sum();
    let by_role = crate::domain::Role::ALL
        .iter()
        .map(|&role| RoleCount {
            role,
            count: players.iter().filter(|p| p.role == role).count(),
        })
        .collect();
    let team_count = players
        .iter()
        .map(|p| p.serie_a_team.as_str())
        .collect::<std::collections::HashSet<_>>()
        .len();

    let mut conn = lock(&db)?;
    let list = queries::save_player_list(&mut conn, &label, &source_file, &players)?;

    Ok(ImportReport { list, by_role, team_count, total_quotation })
}

#[tauri::command]
pub fn player_lists(db: State<'_, Db>) -> Result<Vec<PlayerList>> {
    let conn = lock(&db)?;
    queries::player_lists(&conn)
}

#[tauri::command]
pub fn latest_player_list(db: State<'_, Db>) -> Result<Option<PlayerList>> {
    let conn = lock(&db)?;
    queries::latest_player_list(&conn)
}

#[tauri::command]
pub fn players(
    db: State<'_, Db>,
    list_id: i64,
    filter: Option<PlayerFilter>,
) -> Result<Vec<Player>> {
    let conn = lock(&db)?;
    queries::players(&conn, list_id, &filter.unwrap_or_default())
}

#[tauri::command]
pub fn teams(db: State<'_, Db>, list_id: i64) -> Result<Vec<String>> {
    let conn = lock(&db)?;
    queries::teams(&conn, list_id)
}

#[tauri::command]
pub fn create_auction(db: State<'_, Db>, request: NewAuction) -> Result<Auction> {
    let mut conn = lock(&db)?;
    queries::create_auction(&mut conn, &request)
}

#[tauri::command]
pub fn auctions(db: State<'_, Db>) -> Result<Vec<Auction>> {
    let conn = lock(&db)?;
    queries::auctions(&conn)
}

#[tauri::command]
pub fn auction(db: State<'_, Db>, id: i64) -> Result<Auction> {
    let conn = lock(&db)?;
    queries::auction(&conn, id)
}

#[tauri::command]
pub fn managers(db: State<'_, Db>, auction_id: i64) -> Result<Vec<Manager>> {
    let conn = lock(&db)?;
    queries::managers(&conn, auction_id)
}

#[tauri::command]
pub fn assign_player(
    db: State<'_, Db>,
    auction_id: i64,
    player_id: i64,
    manager_id: i64,
    price: i64,
) -> Result<Pick> {
    let conn = lock(&db)?;
    queries::assign_player(&conn, auction_id, player_id, manager_id, price)
}

#[tauri::command]
pub fn undo_last_pick(db: State<'_, Db>, auction_id: i64) -> Result<Option<PickDetail>> {
    let conn = lock(&db)?;
    queries::undo_last_pick(&conn, auction_id)
}

#[tauri::command]
pub fn picks(db: State<'_, Db>, auction_id: i64) -> Result<Vec<PickDetail>> {
    let conn = lock(&db)?;
    queries::picks(&conn, auction_id)
}

#[tauri::command]
pub fn auction_state(db: State<'_, Db>, auction_id: i64) -> Result<AuctionState> {
    let conn = lock(&db)?;
    queries::auction_state(&conn, auction_id)
}

#[tauri::command]
pub fn active_auction_id(db: State<'_, Db>) -> Result<Option<i64>> {
    let conn = lock(&db)?;
    queries::active_auction_id(&conn)
}

#[tauri::command]
pub fn set_active_auction(db: State<'_, Db>, auction_id: i64) -> Result<()> {
    let conn = lock(&db)?;
    queries::set_active_auction(&conn, auction_id)
}

#[tauri::command]
pub fn save_wish(db: State<'_, Db>, input: WishInput) -> Result<()> {
    let conn = lock(&db)?;
    queries::save_wish(&conn, &input)
}

#[tauri::command]
pub fn remove_wish(db: State<'_, Db>, auction_id: i64, player_id: i64) -> Result<()> {
    let conn = lock(&db)?;
    queries::remove_wish(&conn, auction_id, player_id)
}

#[tauri::command]
pub fn move_wish(db: State<'_, Db>, auction_id: i64, player_id: i64, up: bool) -> Result<()> {
    let mut conn = lock(&db)?;
    queries::move_wish(&mut conn, auction_id, player_id, up)
}

#[tauri::command]
pub fn wishlist(db: State<'_, Db>, auction_id: i64) -> Result<Vec<WishEntry>> {
    let conn = lock(&db)?;
    queries::wishlist(&conn, auction_id)
}

#[tauri::command]
pub fn budget_plan(db: State<'_, Db>, auction_id: i64) -> Result<Vec<BudgetPlanEntry>> {
    let conn = lock(&db)?;
    queries::budget_plan(&conn, auction_id)
}

#[tauri::command]
pub fn set_budget_plan(
    db: State<'_, Db>,
    auction_id: i64,
    plan: Vec<BudgetPlanEntry>,
) -> Result<()> {
    let mut conn = lock(&db)?;
    queries::set_budget_plan(&mut conn, auction_id, &plan)
}

#[tauri::command]
pub fn backup_database(db: State<'_, Db>, path: String) -> Result<()> {
    let conn = lock(&db)?;
    backup::save_to(&conn, &PathBuf::from(path))
}

/// Nome proposto per il file di backup: contiene la data, così più copie
/// nella stessa cartella non si sovrascrivono a vicenda.
#[tauri::command]
pub fn suggested_backup_name() -> String {
    format!(
        "segna-asta-{}.db",
        chrono::Local::now().format("%Y-%m-%d-%H%M")
    )
}

/// Sostituisce i dati correnti con quelli del backup. Prima di farlo mette
/// da parte una copia dello stato attuale: se il backup era quello sbagliato,
/// non si è perso niente.
#[tauri::command]
pub fn restore_database(app: AppHandle, db: State<'_, Db>, path: String) -> Result<String> {
    let safety_copy = app
        .path()
        .app_data_dir()
        .map_err(|err| AppError::invalid(format!("cartella dati non raggiungibile: {err}")))?
        .join("prima-del-ripristino.db");

    let mut conn = lock(&db)?;
    backup::save_to(&conn, &safety_copy)?;
    backup::restore_from(&mut conn, &PathBuf::from(path))?;

    Ok(safety_copy.to_string_lossy().to_string())
}

/// Un mutex avvelenato significa che un altro comando è andato in panico:
/// non è recuperabile in modo sensato, ma almeno lo si dice in chiaro.
fn lock<'a>(db: &'a State<'_, Db>) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>> {
    db.0.lock()
        .map_err(|_| AppError::invalid("il database non è più utilizzabile, riavvia l'app"))
}
