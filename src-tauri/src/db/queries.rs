//! L'unico posto dove si scrive SQL. I comandi Tauri chiamano queste
//! funzioni, il frontend non vede mai una query.

use crate::domain::{Auction, AuctionStatus, Manager, Player, PlayerList, Role, RosterSlots};
use crate::error::{AppError, Result};
use crate::import::ImportedPlayer;
use rusqlite::{params, Connection, Row};
use serde::Deserialize;

// ---------------------------------------------------------------- listone

/// Salva un import come nuova lista. Le liste precedenti restano dove sono:
/// le aste già giocate continuano a puntare alla loro.
pub fn save_player_list(
    conn: &mut Connection,
    label: &str,
    source_file: &str,
    players: &[ImportedPlayer],
) -> Result<PlayerList> {
    let imported_at = now();
    let tx = conn.transaction()?;

    tx.execute(
        "INSERT INTO player_lists (label, source_file, imported_at, player_count)
             VALUES (?1, ?2, ?3, ?4)",
        params![label, source_file, imported_at, players.len() as i64],
    )?;
    let list_id = tx.last_insert_rowid();

    {
        let mut stmt = tx.prepare(
            "INSERT INTO players (list_id, name, serie_a_team, role, quotation)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
        )?;
        for player in players {
            stmt.execute(params![
                list_id,
                player.name,
                player.serie_a_team,
                player.role.as_str(),
                player.quotation,
            ])?;
        }
    }

    tx.commit()?;

    Ok(PlayerList {
        id: list_id,
        label: label.to_string(),
        source_file: source_file.to_string(),
        imported_at,
        player_count: players.len() as i64,
    })
}

pub fn player_lists(conn: &Connection) -> Result<Vec<PlayerList>> {
    let mut stmt = conn.prepare(
        "SELECT id, label, source_file, imported_at, player_count
             FROM player_lists ORDER BY imported_at DESC, id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(PlayerList {
            id: row.get(0)?,
            label: row.get(1)?,
            source_file: row.get(2)?,
            imported_at: row.get(3)?,
            player_count: row.get(4)?,
        })
    })?;
    rows.collect::<rusqlite::Result<_>>().map_err(Into::into)
}

/// La lista importata più di recente: quella che una nuova asta usa di default.
pub fn latest_player_list(conn: &Connection) -> Result<Option<PlayerList>> {
    Ok(player_lists(conn)?.into_iter().next())
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerFilter {
    /// Sottostringa cercata nel nome, senza distinzione di maiuscole.
    pub search: Option<String>,
    pub role: Option<Role>,
    pub team: Option<String>,
}

pub fn players(conn: &Connection, list_id: i64, filter: &PlayerFilter) -> Result<Vec<Player>> {
    // I filtri non applicati diventano NULL e il confronto li ignora: una
    // query sola invece di comporre SQL a pezzi.
    let search = filter
        .search
        .as_deref()
        .map(|s| format!("%{}%", s.trim()))
        .filter(|s| s.len() > 2);

    let mut stmt = conn.prepare(
        "SELECT id, list_id, name, serie_a_team, role, quotation
             FROM players
             WHERE list_id = ?1
               AND (?2 IS NULL OR name LIKE ?2)
               AND (?3 IS NULL OR role = ?3)
               AND (?4 IS NULL OR serie_a_team = ?4)
             ORDER BY quotation DESC, name",
    )?;

    let rows = stmt.query_map(
        params![
            list_id,
            search,
            filter.role.map(|r| r.as_str()),
            filter.team.as_deref(),
        ],
        player_from_row,
    )?;
    rows.collect::<rusqlite::Result<_>>().map_err(Into::into)
}

/// Le squadre presenti in una lista, per popolare il filtro.
pub fn teams(conn: &Connection, list_id: i64) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT serie_a_team FROM players WHERE list_id = ?1 ORDER BY serie_a_team",
    )?;
    let rows = stmt.query_map([list_id], |row| row.get(0))?;
    rows.collect::<rusqlite::Result<_>>().map_err(Into::into)
}

fn player_from_row(row: &Row) -> rusqlite::Result<Player> {
    let role: String = row.get(4)?;
    Ok(Player {
        id: row.get(0)?,
        list_id: row.get(1)?,
        name: row.get(2)?,
        serie_a_team: row.get(3)?,
        // Il CHECK sulla colonna garantisce che sia uno dei quattro ruoli.
        role: Role::parse(&role).unwrap_or(Role::A),
        quotation: row.get(5)?,
    })
}

// ------------------------------------------------------------------ aste

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewAuction {
    pub name: String,
    pub list_id: i64,
    pub budget: i64,
    pub slots: RosterSlots,
    pub is_simulation: bool,
    /// I partecipanti, nell'ordine in cui siedono al tavolo.
    pub managers: Vec<String>,
    /// Quale di loro sono io.
    pub my_index: usize,
}

pub fn create_auction(conn: &mut Connection, req: &NewAuction) -> Result<Auction> {
    if req.name.trim().is_empty() {
        return Err(AppError::invalid("l'asta ha bisogno di un nome"));
    }
    if req.budget <= 0 {
        return Err(AppError::invalid("il budget deve essere maggiore di zero"));
    }
    if req.slots.total() <= 0 {
        return Err(AppError::invalid("la rosa deve avere almeno uno slot"));
    }
    if req.managers.len() < 2 {
        return Err(AppError::invalid("servono almeno due partecipanti"));
    }
    if req.my_index >= req.managers.len() {
        return Err(AppError::invalid("il partecipante che sono io non esiste"));
    }

    let created_at = now();
    let tx = conn.transaction()?;

    tx.execute(
        "INSERT INTO auctions
             (name, list_id, budget, slot_p, slot_d, slot_c, slot_a, created_at, status, is_simulation)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'draft', ?9)",
        params![
            req.name.trim(),
            req.list_id,
            req.budget,
            req.slots.p,
            req.slots.d,
            req.slots.c,
            req.slots.a,
            created_at,
            req.is_simulation as i64,
        ],
    )?;
    let auction_id = tx.last_insert_rowid();

    {
        let mut stmt = tx.prepare(
            "INSERT INTO managers (auction_id, name, is_me, order_index)
                 VALUES (?1, ?2, ?3, ?4)",
        )?;
        for (index, name) in req.managers.iter().enumerate() {
            let name = name.trim();
            if name.is_empty() {
                return Err(AppError::invalid("un partecipante ha il nome vuoto"));
            }
            stmt.execute(params![
                auction_id,
                name,
                (index == req.my_index) as i64,
                index as i64,
            ])?;
        }
    }

    tx.commit()?;

    auction(conn, auction_id)
}

pub fn auctions(conn: &Connection) -> Result<Vec<Auction>> {
    let mut stmt = conn.prepare(&format!("{AUCTION_SELECT} ORDER BY created_at DESC, id DESC"))?;
    let rows = stmt.query_map([], auction_from_row)?;
    rows.collect::<rusqlite::Result<_>>().map_err(Into::into)
}

pub fn auction(conn: &Connection, id: i64) -> Result<Auction> {
    let mut stmt = conn.prepare(&format!("{AUCTION_SELECT} WHERE id = ?1"))?;
    stmt.query_row([id], auction_from_row)
        .map_err(|err| match err {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::not_found(format!("asta {id} inesistente"))
            }
            other => other.into(),
        })
}

const AUCTION_SELECT: &str = "SELECT id, name, list_id, budget, slot_p, slot_d, slot_c, slot_a,
                                     created_at, status, is_simulation
                              FROM auctions";

fn auction_from_row(row: &Row) -> rusqlite::Result<Auction> {
    let status: String = row.get(9)?;
    Ok(Auction {
        id: row.get(0)?,
        name: row.get(1)?,
        list_id: row.get(2)?,
        budget: row.get(3)?,
        slots: RosterSlots {
            p: row.get(4)?,
            d: row.get(5)?,
            c: row.get(6)?,
            a: row.get(7)?,
        },
        created_at: row.get(8)?,
        // Il CHECK sulla colonna garantisce che lo stato sia uno dei tre.
        status: AuctionStatus::parse(&status).unwrap_or(AuctionStatus::Draft),
        is_simulation: row.get::<_, i64>(10)? != 0,
    })
}

pub fn managers(conn: &Connection, auction_id: i64) -> Result<Vec<Manager>> {
    let mut stmt = conn.prepare(
        "SELECT id, auction_id, name, is_me, order_index
             FROM managers WHERE auction_id = ?1 ORDER BY order_index",
    )?;
    let rows = stmt.query_map([auction_id], |row| {
        Ok(Manager {
            id: row.get(0)?,
            auction_id: row.get(1)?,
            name: row.get(2)?,
            is_me: row.get::<_, i64>(3)? != 0,
            order_index: row.get(4)?,
        })
    })?;
    rows.collect::<rusqlite::Result<_>>().map_err(Into::into)
}

fn now() -> String {
    chrono::Local::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;
    use crate::domain::RosterSlots;
    use crate::import;
    use std::path::Path;

    fn listone() -> Vec<crate::import::ImportedPlayer> {
        let path =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../data/quotazioni_fantamaster.xlsx");
        import::read_listone(&path).expect("listone di riferimento leggibile")
    }

    /// Un database con dentro il listone vero: è la catena completa
    /// XLSX → tabelle → query, quella che l'app percorre a ogni import.
    fn db_con_listone() -> (Db, i64) {
        let db = Db::open_in_memory().expect("database in memoria");
        let list = {
            let mut conn = db.0.lock().expect("mutex non avvelenato");
            save_player_list(&mut conn, "Listone 2026", "quotazioni.xlsx", &listone())
                .expect("salvataggio riuscito")
        };
        assert_eq!(list.player_count, 608);
        (db, list.id)
    }

    #[test]
    fn il_listone_salvato_si_rilegge_intero() {
        let (db, list_id) = db_con_listone();
        let conn = db.0.lock().expect("mutex non avvelenato");
        let all = players(&conn, list_id, &PlayerFilter::default()).expect("lettura riuscita");
        assert_eq!(all.len(), 608);
        assert_eq!(all.iter().map(|p| p.quotation).sum::<i64>(), 3702);
    }

    #[test]
    fn i_giocatori_arrivano_ordinati_dal_piu_caro() {
        let (db, list_id) = db_con_listone();
        let conn = db.0.lock().expect("mutex non avvelenato");
        let all = players(&conn, list_id, &PlayerFilter::default()).expect("lettura riuscita");
        let first = all.first().expect("listone non vuoto");
        assert_eq!(first.quotation, 34, "in testa c'è il giocatore più quotato");
    }

    #[test]
    fn il_filtro_per_ruolo_restituisce_solo_quel_reparto() {
        let (db, list_id) = db_con_listone();
        let conn = db.0.lock().expect("mutex non avvelenato");
        let filter = PlayerFilter { role: Some(Role::P), ..Default::default() };
        let goalkeepers = players(&conn, list_id, &filter).expect("lettura riuscita");
        assert_eq!(goalkeepers.len(), 67);
        assert!(goalkeepers.iter().all(|p| p.role == Role::P));
    }

    #[test]
    fn il_filtro_per_squadra_e_la_ricerca_si_combinano() {
        let (db, list_id) = db_con_listone();
        let conn = db.0.lock().expect("mutex non avvelenato");
        let filter = PlayerFilter {
            team: Some("Inter".into()),
            search: Some("dimarco".into()),
            ..Default::default()
        };
        let found = players(&conn, list_id, &filter).expect("lettura riuscita");
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].name, "Dimarco");
    }

    #[test]
    fn ci_sono_tutte_le_squadre_per_il_filtro() {
        let (db, list_id) = db_con_listone();
        let conn = db.0.lock().expect("mutex non avvelenato");
        assert_eq!(teams(&conn, list_id).expect("lettura riuscita").len(), 20);
    }

    #[test]
    fn due_import_convivono_come_liste_separate() {
        let (db, first_id) = db_con_listone();
        let mut conn = db.0.lock().expect("mutex non avvelenato");
        let second = save_player_list(&mut conn, "Aggiornato", "nuovo.xlsx", &listone())
            .expect("secondo import riuscito");

        assert_ne!(second.id, first_id);
        assert_eq!(player_lists(&conn).expect("lettura riuscita").len(), 2);
        // Il più recente è quello che una nuova asta userebbe di default.
        assert_eq!(
            latest_player_list(&conn).expect("lettura riuscita").map(|l| l.id),
            Some(second.id)
        );
    }

    #[test]
    fn creare_un_asta_crea_anche_i_partecipanti() {
        let (db, list_id) = db_con_listone();
        let mut conn = db.0.lock().expect("mutex non avvelenato");
        let auction = create_auction(
            &mut conn,
            &NewAuction {
                name: "Asta 2026".into(),
                list_id,
                budget: 500,
                slots: RosterSlots::DEFAULT,
                is_simulation: false,
                managers: vec!["Io".into(), "Marco".into(), "Luca".into()],
                my_index: 0,
            },
        )
        .expect("asta creata");

        assert_eq!(auction.budget, 500);
        assert_eq!(auction.slots.total(), 25);

        let people = managers(&conn, auction.id).expect("lettura riuscita");
        assert_eq!(people.len(), 3);
        assert_eq!(people.iter().filter(|m| m.is_me).count(), 1);
        assert!(people[0].is_me, "il primo partecipante sono io");
    }

    #[test]
    fn un_asta_senza_avversari_viene_rifiutata() {
        let (db, list_id) = db_con_listone();
        let mut conn = db.0.lock().expect("mutex non avvelenato");
        let result = create_auction(
            &mut conn,
            &NewAuction {
                name: "Solitario".into(),
                list_id,
                budget: 500,
                slots: RosterSlots::DEFAULT,
                is_simulation: false,
                managers: vec!["Io".into()],
                my_index: 0,
            },
        );
        assert!(result.is_err(), "un'asta ha bisogno di almeno due partecipanti");
    }

    #[test]
    fn un_asta_senza_budget_viene_rifiutata() {
        let (db, list_id) = db_con_listone();
        let mut conn = db.0.lock().expect("mutex non avvelenato");
        let result = create_auction(
            &mut conn,
            &NewAuction {
                name: "Senza crediti".into(),
                list_id,
                budget: 0,
                slots: RosterSlots::DEFAULT,
                is_simulation: false,
                managers: vec!["Io".into(), "Marco".into()],
                my_index: 0,
            },
        );
        assert!(result.is_err());
    }

    #[test]
    fn chiedere_un_asta_inesistente_da_errore_non_trovato() {
        let db = Db::open_in_memory().expect("database in memoria");
        let conn = db.0.lock().expect("mutex non avvelenato");
        assert!(matches!(auction(&conn, 999), Err(crate::error::AppError::NotFound(_))));
    }
}
