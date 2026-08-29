//! L'unico posto dove si scrive SQL. I comandi Tauri chiamano queste
//! funzioni, il frontend non vede mai una query.

use crate::domain::budget;
use crate::domain::{
    Auction, AuctionState, AuctionStatus, BudgetPlanEntry, Manager, ManagerState, Pick, PickDetail,
    Player, PlayerList, Role, RosterSlots, Tier, WishEntry,
};
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

// ---------------------------------------------------------- assegnazioni

/// Assegna un giocatore a un partecipante. Il prezzo è quello effettivamente
/// battuto: non viene confrontato col budget, perché a un'asta capita di
/// sforare e l'app deve poterlo registrare invece di impedirlo.
pub fn assign_player(
    conn: &Connection,
    auction_id: i64,
    player_id: i64,
    manager_id: i64,
    price: i64,
) -> Result<Pick> {
    if price < 0 {
        return Err(AppError::invalid("il prezzo non può essere negativo"));
    }

    // La sequenza riprende da dove si era fermata, anche dopo un annullamento.
    let seq: i64 = conn.query_row(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM picks WHERE auction_id = ?1",
        [auction_id],
        |row| row.get(0),
    )?;
    let picked_at = now();

    conn.execute(
        "INSERT INTO picks (auction_id, player_id, manager_id, price, seq, picked_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![auction_id, player_id, manager_id, price, seq, picked_at],
    )
    .map_err(|err| match err {
        rusqlite::Error::SqliteFailure(inner, _)
            if inner.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            AppError::invalid("questo giocatore è già stato assegnato")
        }
        other => other.into(),
    })?;

    Ok(Pick {
        id: conn.last_insert_rowid(),
        auction_id,
        player_id,
        manager_id,
        price,
        seq,
        picked_at,
    })
}

/// Annulla l'ultima assegnazione. Sotto pressione si sbaglia partecipante o
/// si digita un prezzo storto: deve bastare un tasto per tornare indietro.
pub fn undo_last_pick(conn: &Connection, auction_id: i64) -> Result<Option<PickDetail>> {
    let last = picks(conn, auction_id)?.into_iter().next_back();
    let Some(pick) = last else {
        return Ok(None);
    };
    conn.execute("DELETE FROM picks WHERE id = ?1", [pick.id])?;
    Ok(Some(pick))
}

/// Tutte le assegnazioni dell'asta, in ordine di battuta.
pub fn picks(conn: &Connection, auction_id: i64) -> Result<Vec<PickDetail>> {
    let mut stmt = conn.prepare(
        "SELECT k.id, k.player_id, p.name, p.serie_a_team, p.role, p.quotation,
                k.manager_id, m.name, m.is_me, k.price, k.seq
             FROM picks k
             JOIN players p ON p.id = k.player_id
             JOIN managers m ON m.id = k.manager_id
             WHERE k.auction_id = ?1
             ORDER BY k.seq",
    )?;
    let rows = stmt.query_map([auction_id], |row| {
        let role: String = row.get(4)?;
        Ok(PickDetail {
            id: row.get(0)?,
            player_id: row.get(1)?,
            player_name: row.get(2)?,
            serie_a_team: row.get(3)?,
            role: Role::parse(&role).unwrap_or(Role::A),
            quotation: row.get(5)?,
            manager_id: row.get(6)?,
            manager_name: row.get(7)?,
            is_mine: row.get::<_, i64>(8)? != 0,
            price: row.get(9)?,
            seq: row.get(10)?,
        })
    })?;
    rows.collect::<rusqlite::Result<_>>().map_err(Into::into)
}

/// La fotografia dell'asta, ricalcolata dalle assegnazioni a ogni richiesta.
pub fn auction_state(conn: &Connection, auction_id: i64) -> Result<AuctionState> {
    let auction = auction(conn, auction_id)?;
    let people = managers(conn, auction_id)?;
    let all_picks = picks(conn, auction_id)?;

    let states = people
        .into_iter()
        .map(|manager| {
            let mine: Vec<&PickDetail> =
                all_picks.iter().filter(|p| p.manager_id == manager.id).collect();

            let spent: i64 = mine.iter().map(|p| p.price).sum();
            let count = |role: Role| mine.iter().filter(|p| p.role == role).count() as i64;
            let filled = RosterSlots {
                p: count(Role::P),
                d: count(Role::D),
                c: count(Role::C),
                a: count(Role::A),
            };
            // Se in un reparto si è preso più del previsto, il mancante è zero:
            // il conto degli slot residui non deve andare in negativo.
            let missing = RosterSlots {
                p: (auction.slots.p - filled.p).max(0),
                d: (auction.slots.d - filled.d).max(0),
                c: (auction.slots.c - filled.c).max(0),
                a: (auction.slots.a - filled.a).max(0),
            };

            let credits_left = auction.budget - spent;
            let slots_left = missing.total();

            ManagerState {
                manager,
                spent,
                credits_left,
                filled,
                missing,
                slots_left,
                max_bid: budget::max_bid(credits_left, slots_left),
                affordable_average: budget::affordable_average(credits_left, slots_left),
            }
        })
        .collect::<Vec<_>>();

    let total_paid: i64 = all_picks.iter().map(|p| p.price).sum();
    let assigned_quotation: i64 = all_picks.iter().map(|p| p.quotation).sum();
    let manager_count = states.len() as i64;
    let expected_quotation =
        expected_quotation(conn, auction.list_id, manager_count * auction.slots.total())?;

    Ok(AuctionState {
        picks_count: all_picks.len() as i64,
        inflation: budget::inflation(total_paid, assigned_quotation),
        league_inflation: budget::league_inflation(
            auction.budget,
            manager_count,
            expected_quotation,
        ),
        auction,
        managers: states,
        total_paid,
        assigned_quotation,
    })
}

/// Quanto valgono di listino i giocatori che verranno assegnati: i più
/// quotati della lista, tanti quanti bastano a riempire tutte le rose.
/// Non tutto il listone finisce a qualcuno, quindi sommarlo intero
/// falserebbe il riferimento.
fn expected_quotation(conn: &Connection, list_id: i64, roster_places: i64) -> Result<i64> {
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(quotation), 0) FROM (
             SELECT quotation FROM players WHERE list_id = ?1
                 ORDER BY quotation DESC LIMIT ?2
         )",
        params![list_id, roster_places.max(0)],
        |row| row.get(0),
    )?;
    Ok(total)
}

// -------------------------------------------------------- lista desideri

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WishInput {
    pub auction_id: i64,
    pub player_id: i64,
    pub tier: Tier,
    pub target_price: Option<i64>,
    pub max_bid: Option<i64>,
    pub group_label: Option<String>,
    pub notes: Option<String>,
}

/// Aggiunge o aggiorna un obiettivo. Un giocatore già in lista non viene
/// duplicato: si sovrascrivono i suoi valori.
pub fn save_wish(conn: &Connection, input: &WishInput) -> Result<()> {
    if let Some(max) = input.max_bid {
        if max < 0 {
            return Err(AppError::invalid("il tetto d'offerta non può essere negativo"));
        }
    }

    // Chi arriva per ultimo si mette in coda alla sua fascia.
    let priority: i64 = conn.query_row(
        "SELECT COALESCE(MAX(priority), 0) + 1 FROM wishlist WHERE auction_id = ?1",
        [input.auction_id],
        |row| row.get(0),
    )?;

    conn.execute(
        "INSERT INTO wishlist
             (auction_id, player_id, tier, target_price, max_bid, priority, group_label, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(auction_id, player_id) DO UPDATE SET
             tier = excluded.tier,
             target_price = excluded.target_price,
             max_bid = excluded.max_bid,
             group_label = excluded.group_label,
             notes = excluded.notes",
        params![
            input.auction_id,
            input.player_id,
            input.tier.as_i64(),
            input.target_price,
            input.max_bid,
            priority,
            input.group_label.as_deref().filter(|s| !s.trim().is_empty()),
            input.notes.as_deref().filter(|s| !s.trim().is_empty()),
        ],
    )?;
    Ok(())
}

pub fn remove_wish(conn: &Connection, auction_id: i64, player_id: i64) -> Result<()> {
    conn.execute(
        "DELETE FROM wishlist WHERE auction_id = ?1 AND player_id = ?2",
        params![auction_id, player_id],
    )?;
    Ok(())
}

/// Sposta un obiettivo su o giù nella lista, scambiando la priorità con il
/// vicino: l'ordine resta compatto senza rinumerare tutto.
pub fn move_wish(conn: &mut Connection, auction_id: i64, player_id: i64, up: bool) -> Result<()> {
    let entries = wishlist(conn, auction_id)?;
    let index = entries
        .iter()
        .position(|e| e.player_id == player_id)
        .ok_or_else(|| AppError::not_found("obiettivo non in lista"))?;

    let Some(other_index) = (if up { index.checked_sub(1) } else { Some(index + 1) }) else {
        return Ok(()); // già in cima
    };
    let Some(other) = entries.get(other_index) else {
        return Ok(()); // già in fondo
    };
    let current = &entries[index];

    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE wishlist SET priority = ?1 WHERE auction_id = ?2 AND player_id = ?3",
        params![other.priority, auction_id, current.player_id],
    )?;
    tx.execute(
        "UPDATE wishlist SET priority = ?1 WHERE auction_id = ?2 AND player_id = ?3",
        params![current.priority, auction_id, other.player_id],
    )?;
    tx.commit()?;
    Ok(())
}

/// Gli obiettivi in ordine di fascia e priorità, ognuno con lo stato: chi
/// se l'è preso e a quanto, se qualcuno l'ha fatto.
pub fn wishlist(conn: &Connection, auction_id: i64) -> Result<Vec<WishEntry>> {
    let mut stmt = conn.prepare(
        "SELECT w.id, w.player_id, p.name, p.serie_a_team, p.role, p.quotation,
                w.tier, w.target_price, w.max_bid, w.priority, w.group_label, w.notes,
                m.name, k.price, m.is_me
             FROM wishlist w
             JOIN players p ON p.id = w.player_id
             LEFT JOIN picks k ON k.player_id = w.player_id AND k.auction_id = w.auction_id
             LEFT JOIN managers m ON m.id = k.manager_id
             WHERE w.auction_id = ?1
             ORDER BY w.tier, w.priority",
    )?;
    let rows = stmt.query_map([auction_id], |row| {
        let role: String = row.get(4)?;
        let tier: i64 = row.get(6)?;
        Ok(WishEntry {
            id: row.get(0)?,
            player_id: row.get(1)?,
            player_name: row.get(2)?,
            serie_a_team: row.get(3)?,
            role: Role::parse(&role).unwrap_or(Role::A),
            quotation: row.get(5)?,
            tier: Tier::parse(tier).unwrap_or(Tier::Scommessa),
            target_price: row.get(7)?,
            max_bid: row.get(8)?,
            priority: row.get(9)?,
            group_label: row.get(10)?,
            notes: row.get(11)?,
            taken_by: row.get(12)?,
            taken_price: row.get(13)?,
            taken_by_me: row.get::<_, Option<i64>>(14)?.unwrap_or(0) != 0,
        })
    })?;
    rows.collect::<rusqlite::Result<_>>().map_err(Into::into)
}

// --------------------------------------------------------- piano di spesa

/// Quanto budget intendo destinare a ogni reparto. Senza un piano salvato
/// si parte da una ripartizione classica: pochi crediti sui portieri, il
/// grosso su centrocampo e attacco.
pub fn budget_plan(conn: &Connection, auction_id: i64) -> Result<Vec<BudgetPlanEntry>> {
    let mut stmt = conn
        .prepare("SELECT role, target_pct FROM budget_plan WHERE auction_id = ?1")?;
    let rows = stmt.query_map([auction_id], |row| {
        let role: String = row.get(0)?;
        Ok(BudgetPlanEntry {
            role: Role::parse(&role).unwrap_or(Role::A),
            target_pct: row.get(1)?,
        })
    })?;
    let saved: Vec<BudgetPlanEntry> = rows.collect::<rusqlite::Result<_>>()?;

    if saved.len() == Role::ALL.len() {
        return Ok(saved);
    }
    Ok(DEFAULT_PLAN
        .iter()
        .map(|&(role, target_pct)| BudgetPlanEntry { role, target_pct })
        .collect())
}

const DEFAULT_PLAN: [(Role, f64); 4] = [
    (Role::P, 6.0),
    (Role::D, 14.0),
    (Role::C, 30.0),
    (Role::A, 50.0),
];

pub fn set_budget_plan(
    conn: &mut Connection,
    auction_id: i64,
    plan: &[BudgetPlanEntry],
) -> Result<()> {
    let tx = conn.transaction()?;
    for entry in plan {
        if entry.target_pct < 0.0 {
            return Err(AppError::invalid("una quota di budget non può essere negativa"));
        }
        tx.execute(
            "INSERT INTO budget_plan (auction_id, role, target_pct) VALUES (?1, ?2, ?3)
                 ON CONFLICT(auction_id, role) DO UPDATE SET target_pct = excluded.target_pct",
            params![auction_id, entry.role.as_str(), entry.target_pct],
        )?;
    }
    tx.commit()?;
    Ok(())
}

// ------------------------------------------------------------ preferenze

/// L'asta su cui si sta lavorando, ricordata fra un avvio e l'altro.
pub fn active_auction_id(conn: &Connection) -> Result<Option<i64>> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'active_auction_id'",
            [],
            |row| row.get(0),
        )
        .ok();
    Ok(raw.and_then(|v| v.parse().ok()))
}

pub fn set_active_auction(conn: &Connection, auction_id: i64) -> Result<()> {
    // Fallisce se l'asta non esiste, invece di ricordare un riferimento morto.
    auction(conn, auction_id)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('active_auction_id', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![auction_id.to_string()],
    )?;
    Ok(())
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


    /// Un'asta pronta all'uso: listone vero, 500 crediti, rosa standard,
    /// tre partecipanti di cui il primo sono io.
    fn asta_pronta() -> (Db, i64, Vec<Manager>, Vec<Player>) {
        let (db, list_id) = db_con_listone();
        let (auction_id, people, all) = {
            let mut conn = db.0.lock().expect("mutex non avvelenato");
            let auction = create_auction(
                &mut conn,
                &NewAuction {
                    name: "Asta".into(),
                    list_id,
                    budget: 500,
                    slots: RosterSlots::DEFAULT,
                    is_simulation: false,
                    managers: vec!["Io".into(), "Marco".into(), "Luca".into()],
                    my_index: 0,
                },
            )
            .expect("asta creata");
            let people = managers(&conn, auction.id).expect("partecipanti letti");
            let all = players(&conn, list_id, &PlayerFilter::default()).expect("listone letto");
            (auction.id, people, all)
        };
        (db, auction_id, people, all)
    }

    #[test]
    fn assegnare_un_giocatore_scala_crediti_e_slot() {
        let (db, auction_id, people, all) = asta_pronta();
        let conn = db.0.lock().expect("mutex non avvelenato");
        let me = &people[0];
        let attacker = all.iter().find(|p| p.role == Role::A).expect("un attaccante c'è");

        assign_player(&conn, auction_id, attacker.id, me.id, 120).expect("assegnazione riuscita");

        let state = auction_state(&conn, auction_id).expect("stato leggibile");
        let mine = state.managers.iter().find(|m| m.manager.is_me).expect("ci sono io");
        assert_eq!(mine.spent, 120);
        assert_eq!(mine.credits_left, 380);
        assert_eq!(mine.filled.a, 1);
        assert_eq!(mine.missing.a, 5);
        assert_eq!(mine.slots_left, 24);
        // 380 crediti con 24 slot da riempire: ne posso offrire 357.
        assert_eq!(mine.max_bid, 357);
    }

    #[test]
    fn lo_stesso_giocatore_non_si_assegna_due_volte() {
        let (db, auction_id, people, all) = asta_pronta();
        let conn = db.0.lock().expect("mutex non avvelenato");
        let player = &all[0];

        assign_player(&conn, auction_id, player.id, people[0].id, 30).expect("prima assegnazione");
        let second = assign_player(&conn, auction_id, player.id, people[1].id, 40);

        let err = second.expect_err("la seconda assegnazione deve fallire");
        assert!(
            err.to_string().contains("già stato assegnato"),
            "l'errore deve dire cosa è successo, non citare un vincolo SQL: {err}"
        );
    }

    #[test]
    fn annullare_riporta_esattamente_allo_stato_di_prima() {
        let (db, auction_id, people, all) = asta_pronta();
        let conn = db.0.lock().expect("mutex non avvelenato");

        assign_player(&conn, auction_id, all[0].id, people[0].id, 50).expect("prima assegnazione");
        let before = auction_state(&conn, auction_id).expect("stato leggibile");

        assign_player(&conn, auction_id, all[1].id, people[1].id, 70).expect("seconda assegnazione");
        let undone = undo_last_pick(&conn, auction_id).expect("annullamento riuscito");

        let after = auction_state(&conn, auction_id).expect("stato leggibile");
        assert_eq!(undone.map(|p| p.player_id), Some(all[1].id));
        assert_eq!(after.picks_count, before.picks_count);
        assert_eq!(after.total_paid, before.total_paid);
        assert_eq!(
            after.managers[1].credits_left, before.managers[1].credits_left,
            "il partecipante torna ai crediti che aveva"
        );
    }

    #[test]
    fn annullare_a_mani_vuote_non_e_un_errore() {
        let (db, auction_id, _, _) = asta_pronta();
        let conn = db.0.lock().expect("mutex non avvelenato");
        assert!(undo_last_pick(&conn, auction_id).expect("nessun errore").is_none());
    }

    #[test]
    fn dopo_un_annullamento_la_sequenza_non_si_sovrappone() {
        let (db, auction_id, people, all) = asta_pronta();
        let conn = db.0.lock().expect("mutex non avvelenato");

        assign_player(&conn, auction_id, all[0].id, people[0].id, 10).expect("prima");
        assign_player(&conn, auction_id, all[1].id, people[0].id, 10).expect("seconda");
        undo_last_pick(&conn, auction_id).expect("annullata la seconda");
        let third = assign_player(&conn, auction_id, all[2].id, people[0].id, 10).expect("terza");

        assert_eq!(third.seq, 2, "la sequenza riprende dal posto lasciato libero");
        let ordered = picks(&conn, auction_id).expect("lettura riuscita");
        assert_eq!(ordered.len(), 2);
        assert_eq!(ordered.last().map(|p| p.player_id), Some(all[2].id));
    }

    #[test]
    fn l_inflazione_confronta_il_pagato_col_listino() {
        let (db, auction_id, people, all) = asta_pronta();
        let conn = db.0.lock().expect("mutex non avvelenato");
        let player = &all[0];

        // Pagato il doppio della quotazione: il mercato corre.
        assign_player(&conn, auction_id, player.id, people[0].id, player.quotation * 2)
            .expect("assegnazione riuscita");

        let state = auction_state(&conn, auction_id).expect("stato leggibile");
        let inflation = state.inflation.expect("con una assegnazione è definita");
        assert!((inflation - 2.0).abs() < f64::EPSILON);
    }

    #[test]
    fn sforare_il_budget_e_permesso_ma_si_vede() {
        let (db, auction_id, people, all) = asta_pronta();
        let conn = db.0.lock().expect("mutex non avvelenato");

        // All'asta capita di sfondare il budget: l'app lo registra invece di
        // impedirlo, ma i crediti residui vanno in negativo e il max bid a zero.
        assign_player(&conn, auction_id, all[0].id, people[0].id, 600).expect("registrata");

        let state = auction_state(&conn, auction_id).expect("stato leggibile");
        let mine = &state.managers[0];
        assert_eq!(mine.credits_left, -100);
        assert_eq!(mine.max_bid, 0);
    }

    #[test]
    fn l_asta_attiva_si_ricorda_e_rifiuta_riferimenti_morti() {
        let (db, auction_id, _, _) = asta_pronta();
        let conn = db.0.lock().expect("mutex non avvelenato");

        assert_eq!(active_auction_id(&conn).expect("lettura"), None);
        set_active_auction(&conn, auction_id).expect("asta esistente");
        assert_eq!(active_auction_id(&conn).expect("lettura"), Some(auction_id));
        assert!(set_active_auction(&conn, 999).is_err(), "un'asta inesistente non si attiva");
    }


    #[test]
    fn il_riferimento_di_lega_guarda_i_giocatori_che_verranno_assegnati() {
        let (db, list_id) = db_con_listone();
        let mut conn = db.0.lock().expect("mutex non avvelenato");
        let auction = create_auction(
            &mut conn,
            &NewAuction {
                name: "Lega da otto".into(),
                list_id,
                budget: 500,
                slots: RosterSlots::DEFAULT,
                is_simulation: false,
                managers: (0..8).map(|i| format!("Team {i}")).collect(),
                my_index: 0,
            },
        )
        .expect("asta creata");

        let state = auction_state(&conn, auction.id).expect("stato leggibile");
        let reference = state.league_inflation.expect("la lega ha partecipanti");

        // 8 rose da 25 fanno 200 posti: si sommano le quotazioni dei 200
        // giocatori più cari, non tutte e 608, altrimenti il riferimento
        // uscirebbe più basso del vero.
        let assigned_worth = expected_quotation(&conn, list_id, 200).expect("somma leggibile");
        let whole_listone = expected_quotation(&conn, list_id, 10_000).expect("somma leggibile");
        assert!(assigned_worth < whole_listone, "non tutto il listone verrà assegnato");
        assert_eq!(whole_listone, 3702, "il listone intero vale quanto ci si aspetta");

        assert!(
            (reference - 4000.0 / assigned_worth as f64).abs() < 0.001,
            "il riferimento sono tutti i crediti della lega sulle quotazioni attese"
        );
        assert!(
            (1.0..3.0).contains(&reference),
            "un riferimento fuori da questa forbice segnala un conto sbagliato: {reference}"
        );
    }


    #[test]
    fn un_obiettivo_salvato_due_volte_si_aggiorna_invece_di_sdoppiarsi() {
        let (db, auction_id, _, all) = asta_pronta();
        let conn = db.0.lock().expect("mutex non avvelenato");
        let player = &all[0];

        let mut input = WishInput {
            auction_id,
            player_id: player.id,
            tier: Tier::Top,
            target_price: Some(40),
            max_bid: Some(55),
            group_label: None,
            notes: None,
        };
        save_wish(&conn, &input).expect("primo salvataggio");
        input.max_bid = Some(70);
        input.tier = Tier::Buono;
        save_wish(&conn, &input).expect("secondo salvataggio");

        let list = wishlist(&conn, auction_id).expect("lettura riuscita");
        assert_eq!(list.len(), 1, "lo stesso giocatore non compare due volte");
        assert_eq!(list[0].max_bid, Some(70));
        assert_eq!(list[0].tier, Tier::Buono);
    }

    #[test]
    fn la_lista_dice_chi_ha_soffiato_l_obiettivo() {
        let (db, auction_id, people, all) = asta_pronta();
        let conn = db.0.lock().expect("mutex non avvelenato");
        let player = &all[0];

        save_wish(
            &conn,
            &WishInput {
                auction_id,
                player_id: player.id,
                tier: Tier::Top,
                target_price: Some(30),
                max_bid: Some(40),
                group_label: None,
                notes: None,
            },
        )
        .expect("obiettivo salvato");
        // Se lo prende un avversario, l'obiettivo resta in lista ma segnato.
        assign_player(&conn, auction_id, player.id, people[1].id, 45).expect("assegnato al rivale");

        let entry = &wishlist(&conn, auction_id).expect("lettura riuscita")[0];
        assert_eq!(entry.taken_by.as_deref(), Some("Marco"));
        assert_eq!(entry.taken_price, Some(45));
        assert!(!entry.taken_by_me);
    }

    #[test]
    fn gli_obiettivi_si_riordinano_uno_alla_volta() {
        let (db, auction_id, _, all) = asta_pronta();
        let mut conn = db.0.lock().expect("mutex non avvelenato");
        for player in all.iter().take(3) {
            save_wish(
                &conn,
                &WishInput {
                    auction_id,
                    player_id: player.id,
                    tier: Tier::Top,
                    target_price: None,
                    max_bid: None,
                    group_label: None,
                    notes: None,
                },
            )
            .expect("obiettivo salvato");
        }

        let before: Vec<i64> =
            wishlist(&conn, auction_id).unwrap().iter().map(|e| e.player_id).collect();
        move_wish(&mut conn, auction_id, before[2], true).expect("spostato su");
        let after: Vec<i64> =
            wishlist(&conn, auction_id).unwrap().iter().map(|e| e.player_id).collect();

        assert_eq!(after, vec![before[0], before[2], before[1]]);
    }

    #[test]
    fn spostare_oltre_i_bordi_non_fa_danni() {
        let (db, auction_id, _, all) = asta_pronta();
        let mut conn = db.0.lock().expect("mutex non avvelenato");
        save_wish(
            &conn,
            &WishInput {
                auction_id,
                player_id: all[0].id,
                tier: Tier::Top,
                target_price: None,
                max_bid: None,
                group_label: None,
                notes: None,
            },
        )
        .expect("obiettivo salvato");

        move_wish(&mut conn, auction_id, all[0].id, true).expect("in cima resta in cima");
        move_wish(&mut conn, auction_id, all[0].id, false).expect("in fondo resta in fondo");
        assert_eq!(wishlist(&conn, auction_id).unwrap().len(), 1);
    }

    #[test]
    fn senza_un_piano_salvato_se_ne_propone_uno_sensato() {
        let (db, auction_id, _, _) = asta_pronta();
        let mut conn = db.0.lock().expect("mutex non avvelenato");

        let proposed = budget_plan(&conn, auction_id).expect("piano di partenza");
        assert_eq!(proposed.len(), 4);
        let total: f64 = proposed.iter().map(|e| e.target_pct).sum();
        assert!((total - 100.0).abs() < f64::EPSILON, "le quote di partenza fanno 100");

        let mine = vec![
            BudgetPlanEntry { role: Role::P, target_pct: 10.0 },
            BudgetPlanEntry { role: Role::D, target_pct: 20.0 },
            BudgetPlanEntry { role: Role::C, target_pct: 30.0 },
            BudgetPlanEntry { role: Role::A, target_pct: 40.0 },
        ];
        set_budget_plan(&mut conn, auction_id, &mine).expect("piano salvato");
        let saved = budget_plan(&conn, auction_id).expect("piano riletto");
        let goalkeepers = saved.iter().find(|e| e.role == Role::P).expect("i portieri ci sono");
        assert!((goalkeepers.target_pct - 10.0).abs() < f64::EPSILON);
    }

    #[test]
    fn chiedere_un_asta_inesistente_da_errore_non_trovato() {
        let db = Db::open_in_memory().expect("database in memoria");
        let conn = db.0.lock().expect("mutex non avvelenato");
        assert!(matches!(auction(&conn, 999), Err(crate::error::AppError::NotFound(_))));
    }
}
