pub mod queries;

use crate::error::Result;
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

/// Le migrazioni, in ordine. L'indice + 1 è la versione che portano.
/// Per evolvere lo schema si aggiunge un file in coda, mai si modifica
/// uno già rilasciato.
const MIGRATIONS: &[&str] = &[include_str!("schema_v1.sql")];

/// La connessione al database, condivisa fra i comandi Tauri.
/// SQLite in-process non ha bisogno di un pool: un mutex basta e avanza.
pub struct Db(pub Mutex<Connection>);

impl Db {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        prepare(&conn)?;
        Ok(Self(Mutex::new(conn)))
    }

    /// Database in memoria, per i test.
    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        prepare(&conn)?;
        Ok(Self(Mutex::new(conn)))
    }
}

fn prepare(conn: &Connection) -> Result<()> {
    // I vincoli di integrità referenziale in SQLite sono spenti di default.
    conn.pragma_update(None, "foreign_keys", "ON")?;
    // WAL: le letture non aspettano la scrittura in corso, e durante l'asta
    // si scrive spesso mentre le viste leggono.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    migrate(conn)
}

/// Applica le migrazioni mancanti, usando `user_version` come contatore.
fn migrate(conn: &Connection) -> Result<()> {
    let current: i64 =
        conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    for (index, sql) in MIGRATIONS.iter().enumerate() {
        let version = index as i64 + 1;
        if version <= current {
            continue;
        }
        conn.execute_batch(sql)?;
        // pragma_update non accetta parametri, ma `version` è un intero
        // che deriva da un indice, non da input esterno.
        conn.pragma_update(None, "user_version", version)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn le_migrazioni_portano_il_database_all_ultima_versione() {
        let db = Db::open_in_memory().expect("database in memoria");
        let conn = db.0.lock().expect("mutex non avvelenato");
        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("user_version leggibile");
        assert_eq!(version, MIGRATIONS.len() as i64);
    }

    #[test]
    fn applicare_le_migrazioni_due_volte_non_rompe_nulla() {
        let db = Db::open_in_memory().expect("database in memoria");
        let conn = db.0.lock().expect("mutex non avvelenato");
        migrate(&conn).expect("seconda passata innocua");
    }

    #[test]
    fn un_giocatore_va_a_un_solo_partecipante() {
        let db = Db::open_in_memory().expect("database in memoria");
        let conn = db.0.lock().expect("mutex non avvelenato");
        conn.execute_batch(
            "INSERT INTO player_lists (id, label, source_file, imported_at, player_count)
                 VALUES (1, 'test', 'test.xlsx', '2026-08-29', 1);
             INSERT INTO players (id, list_id, name, serie_a_team, role, quotation)
                 VALUES (1, 1, 'Dimarco', 'Inter', 'D', 23);
             INSERT INTO auctions (id, name, list_id, budget, slot_p, slot_d, slot_c, slot_a, created_at)
                 VALUES (1, 'Asta', 1, 500, 3, 8, 8, 6, '2026-08-29');
             INSERT INTO managers (id, auction_id, name, is_me, order_index)
                 VALUES (1, 1, 'Io', 1, 0), (2, 1, 'Rivale', 0, 1);
             INSERT INTO picks (auction_id, player_id, manager_id, price, seq, picked_at)
                 VALUES (1, 1, 1, 25, 1, '2026-08-29');",
        )
        .expect("dati di partenza validi");

        let duplicate = conn.execute(
            "INSERT INTO picks (auction_id, player_id, manager_id, price, seq, picked_at)
                 VALUES (1, 1, 2, 30, 2, '2026-08-29')",
            [],
        );
        assert!(duplicate.is_err(), "lo stesso giocatore non può andare a due partecipanti");
    }

    #[test]
    fn in_un_asta_ci_sono_io_una_volta_sola() {
        let db = Db::open_in_memory().expect("database in memoria");
        let conn = db.0.lock().expect("mutex non avvelenato");
        conn.execute_batch(
            "INSERT INTO player_lists (id, label, source_file, imported_at, player_count)
                 VALUES (1, 'test', 'test.xlsx', '2026-08-29', 0);
             INSERT INTO auctions (id, name, list_id, budget, slot_p, slot_d, slot_c, slot_a, created_at)
                 VALUES (1, 'Asta', 1, 500, 3, 8, 8, 6, '2026-08-29');
             INSERT INTO managers (auction_id, name, is_me, order_index)
                 VALUES (1, 'Io', 1, 0);",
        )
        .expect("dati di partenza validi");

        let second_me = conn.execute(
            "INSERT INTO managers (auction_id, name, is_me, order_index)
                 VALUES (1, 'Anche io', 1, 1)",
            [],
        );
        assert!(second_me.is_err(), "un'asta ha un solo partecipante marcato come me");
    }
}
