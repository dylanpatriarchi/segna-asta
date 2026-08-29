//! Lettura del listone svincolati esportato da FantaMaster.
//!
//! Il foglio ha una struttura semplice e stabile: una riga di titolo, una di
//! intestazione, poi una riga per giocatore con nome, squadra, ruolo e
//! quotazione. In coda ci sono righe di servizio ("Ultimo aggiornamento…",
//! "Scarica FantaMaster") che non sono giocatori: invece di contarle e
//! saltarle, si tengono solo le righe il cui ruolo è uno dei quattro validi.

use crate::domain::Role;
use crate::error::{AppError, Result};
use calamine::{open_workbook, Data, Reader, Xlsx};
use std::path::Path;

/// Il foglio che contiene già tutti i ruoli insieme; gli altri sono viste
/// parziali dello stesso elenco.
const PREFERRED_SHEET: &str = "Tutti";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportedPlayer {
    pub name: String,
    pub serie_a_team: String,
    pub role: Role,
    pub quotation: i64,
}

pub fn read_listone(path: &Path) -> Result<Vec<ImportedPlayer>> {
    let mut workbook: Xlsx<_> = open_workbook(path)?;

    let sheet = pick_sheet(&workbook)?;
    let range = workbook.worksheet_range(&sheet)?;

    let mut players = Vec::new();
    for row in range.rows() {
        if let Some(player) = parse_row(row) {
            players.push(player);
        }
    }

    if players.is_empty() {
        return Err(AppError::invalid(format!(
            "nel foglio «{sheet}» non c'è nessun giocatore riconoscibile"
        )));
    }

    Ok(players)
}

fn pick_sheet(workbook: &Xlsx<std::io::BufReader<std::fs::File>>) -> Result<String> {
    let names = workbook.sheet_names();
    if names.iter().any(|n| n == PREFERRED_SHEET) {
        return Ok(PREFERRED_SHEET.to_string());
    }
    names
        .first()
        .cloned()
        .ok_or_else(|| AppError::invalid("il file non contiene nessun foglio"))
}

/// Una riga diventa un giocatore solo se ha tutte e quattro le colonne
/// valorizzate e il ruolo è riconoscibile. Tutto il resto è intestazione
/// o riga di servizio.
fn parse_row(row: &[Data]) -> Option<ImportedPlayer> {
    let name = cell_text(row.first()?)?;
    let serie_a_team = cell_text(row.get(1)?)?;
    let role = Role::parse(&cell_text(row.get(2)?)?).ok()?;
    let quotation = cell_number(row.get(3)?)?;

    if quotation < 1 {
        return None;
    }

    Some(ImportedPlayer { name, serie_a_team, role, quotation })
}

fn cell_text(cell: &Data) -> Option<String> {
    let text = match cell {
        Data::String(s) => s.trim().to_string(),
        Data::Int(n) => n.to_string(),
        Data::Float(n) => n.to_string(),
        _ => return None,
    };
    (!text.is_empty()).then_some(text)
}

fn cell_number(cell: &Data) -> Option<i64> {
    match cell {
        Data::Int(n) => Some(*n),
        Data::Float(n) => Some(n.round() as i64),
        Data::String(s) => s.trim().parse().ok(),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    /// Il listone di riferimento versionato nel repo. I numeri attesi sono
    /// stati estratti dal file stesso e valgono da test di regressione:
    /// se l'importer perde righe o ne inventa, qui salta fuori.
    fn listone() -> Vec<ImportedPlayer> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../data/quotazioni_fantamaster.xlsx");
        read_listone(&path).expect("listone di riferimento leggibile")
    }

    #[test]
    fn importa_tutti_e_soli_i_giocatori() {
        assert_eq!(listone().len(), 608);
    }

    #[test]
    fn la_ripartizione_per_ruolo_corrisponde_al_listone() {
        let players = listone();
        let count = |role: Role| players.iter().filter(|p| p.role == role).count();
        assert_eq!(count(Role::P), 67);
        assert_eq!(count(Role::D), 210);
        assert_eq!(count(Role::C), 224);
        assert_eq!(count(Role::A), 107);
    }

    #[test]
    fn ci_sono_le_venti_squadre_di_serie_a() {
        let teams: HashSet<_> = listone().into_iter().map(|p| p.serie_a_team).collect();
        assert_eq!(teams.len(), 20);
    }

    #[test]
    fn la_somma_delle_quotazioni_e_quella_attesa() {
        let total: i64 = listone().iter().map(|p| p.quotation).sum();
        assert_eq!(total, 3702);
    }

    #[test]
    fn nessun_nome_compare_due_volte() {
        let players = listone();
        let unique: HashSet<_> = players.iter().map(|p| &p.name).collect();
        assert_eq!(unique.len(), players.len());
    }

    #[test]
    fn le_righe_di_servizio_in_coda_non_diventano_giocatori() {
        let players = listone();
        assert!(
            !players.iter().any(|p| p.name.starts_with("Ultimo aggiornamento")
                || p.name.starts_with("Scarica")),
            "le righe di coda del foglio non sono giocatori"
        );
    }

    #[test]
    fn un_file_inesistente_da_errore_leggibile() {
        let result = read_listone(Path::new("/non/esiste.xlsx"));
        assert!(result.is_err());
    }
}
