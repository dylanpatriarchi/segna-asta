//! Copia di sicurezza del database.
//!
//! Si usa l'API di backup di SQLite invece di copiare il file: con il
//! journal in modalità WAL una copia fatta a mano può perdere le ultime
//! transazioni, che è esattamente quello che un backup non deve fare.

use crate::error::{AppError, Result};
use rusqlite::{backup::Backup, Connection};
use std::path::Path;

/// Scrive il contenuto del database corrente nel file indicato.
pub fn save_to(conn: &Connection, destination: &Path) -> Result<()> {
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut target = Connection::open(destination)?;
    let backup = Backup::new(conn, &mut target)?;
    backup.run_to_completion(64, std::time::Duration::from_millis(0), None)?;
    Ok(())
}

/// Sostituisce il contenuto del database corrente con quello del file
/// indicato. Il file aperto dall'app resta lo stesso: si riscrivono le
/// pagine, così le connessioni già in mano ai comandi restano valide.
pub fn restore_from(conn: &mut Connection, source: &Path) -> Result<()> {
    if !source.exists() {
        return Err(AppError::not_found(format!(
            "il file {} non esiste",
            source.display()
        )));
    }

    // Un file qualsiasi rinominato .db manderebbe in errore il ripristino a
    // metà strada, lasciando il database dell'app a pezzi: si controlla
    // prima che dentro ci sia davvero un'asta.
    let candidate = Connection::open(source)?;
    let tables: i64 = candidate.query_row(
        "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'table' AND name IN ('players', 'auctions', 'picks')",
        [],
        |row| row.get(0),
    )?;
    if tables < 3 {
        return Err(AppError::invalid(
            "questo file non sembra un backup di Segna-Asta",
        ));
    }
    drop(candidate);

    let origin = Connection::open(source)?;
    let backup = Backup::new(&origin, conn)?;
    backup.run_to_completion(64, std::time::Duration::from_millis(0), None)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    fn conta_giocatori(conn: &Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM players", [], |row| row.get(0))
            .expect("conteggio leggibile")
    }

    fn con_un_giocatore(conn: &Connection, name: &str) {
        conn.execute_batch(&format!(
            "INSERT OR IGNORE INTO player_lists (id, label, source_file, imported_at, player_count)
                 VALUES (1, 'test', 'test.xlsx', '2026-08-29', 1);
             INSERT INTO players (list_id, name, serie_a_team, role, quotation)
                 VALUES (1, '{name}', 'Inter', 'D', 10);"
        ))
        .expect("inserimento riuscito");
    }

    #[test]
    fn il_backup_si_rilegge_con_dentro_gli_stessi_dati() {
        let dir = std::env::temp_dir().join("segna-asta-test-backup");
        let _ = std::fs::remove_dir_all(&dir);
        let file = dir.join("copia.db");

        let db = Db::open_in_memory().expect("database in memoria");
        {
            let conn = db.0.lock().expect("mutex non avvelenato");
            con_un_giocatore(&conn, "Dimarco");
            save_to(&conn, &file).expect("backup scritto");
        }

        let copia = Connection::open(&file).expect("backup apribile");
        assert_eq!(conta_giocatori(&copia), 1);
        let name: String = copia
            .query_row("SELECT name FROM players", [], |row| row.get(0))
            .expect("il giocatore c'è");
        assert_eq!(name, "Dimarco");
    }

    #[test]
    fn il_ripristino_riporta_i_dati_del_backup() {
        let dir = std::env::temp_dir().join("segna-asta-test-restore");
        let _ = std::fs::remove_dir_all(&dir);
        let file = dir.join("copia.db");

        let db = Db::open_in_memory().expect("database in memoria");
        {
            let conn = db.0.lock().expect("mutex non avvelenato");
            con_un_giocatore(&conn, "Bastoni");
            save_to(&conn, &file).expect("backup scritto");
            // Il database va avanti dopo il backup: il ripristino deve
            // riportarlo indietro, non sommarsi a quello che c'è.
            con_un_giocatore(&conn, "Bremer");
            assert_eq!(conta_giocatori(&conn), 2);
        }

        {
            let mut conn = db.0.lock().expect("mutex non avvelenato");
            restore_from(&mut conn, &file).expect("ripristino riuscito");
            assert_eq!(conta_giocatori(&conn), 1);
            let name: String = conn
                .query_row("SELECT name FROM players", [], |row| row.get(0))
                .expect("il giocatore c'è");
            assert_eq!(name, "Bastoni");
        }
    }

    #[test]
    fn un_file_qualsiasi_non_viene_scambiato_per_un_backup() {
        let dir = std::env::temp_dir().join("segna-asta-test-estraneo");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("cartella creata");
        let file = dir.join("altro.db");

        let estraneo = Connection::open(&file).expect("database creato");
        estraneo
            .execute_batch("CREATE TABLE ricette (nome TEXT)")
            .expect("tabella creata");
        drop(estraneo);

        let db = Db::open_in_memory().expect("database in memoria");
        let mut conn = db.0.lock().expect("mutex non avvelenato");
        con_un_giocatore(&conn, "Dimarco");

        let result = restore_from(&mut conn, &file);
        assert!(result.is_err(), "un file estraneo non si ripristina");
        assert_eq!(
            conta_giocatori(&conn),
            1,
            "e il database dell'app resta intatto"
        );
    }

    #[test]
    fn ripristinare_da_un_file_inesistente_da_errore_leggibile() {
        let db = Db::open_in_memory().expect("database in memoria");
        let mut conn = db.0.lock().expect("mutex non avvelenato");
        let err = restore_from(&mut conn, Path::new("/non/esiste.db"))
            .expect_err("deve fallire");
        assert!(err.to_string().contains("non esiste"));
    }
}
