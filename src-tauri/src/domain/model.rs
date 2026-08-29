use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};

/// I quattro ruoli del fantacalcio classic. Il listone FantaMaster non usa
/// i ruoli Mantra, quindi non c'è nulla da modellare oltre questi.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Role {
    P,
    D,
    C,
    A,
}

impl Role {
    pub const ALL: [Role; 4] = [Role::P, Role::D, Role::C, Role::A];

    pub fn as_str(self) -> &'static str {
        match self {
            Role::P => "P",
            Role::D => "D",
            Role::C => "C",
            Role::A => "A",
        }
    }

    pub fn parse(raw: &str) -> Result<Self> {
        match raw.trim().to_uppercase().as_str() {
            "P" => Ok(Role::P),
            "D" => Ok(Role::D),
            "C" => Ok(Role::C),
            "A" => Ok(Role::A),
            other => Err(AppError::invalid(format!("ruolo sconosciuto: {other}"))),
        }
    }
}

/// Un'importazione del listone. Ogni import è una lista a sé, così
/// aggiornare le quotazioni non tocca le aste già giocate.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerList {
    pub id: i64,
    pub label: String,
    pub source_file: String,
    pub imported_at: String,
    pub player_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    pub id: i64,
    pub list_id: i64,
    pub name: String,
    pub serie_a_team: String,
    pub role: Role,
    pub quotation: i64,
}

/// Quanti giocatori servono per reparto per completare la rosa.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RosterSlots {
    pub p: i64,
    pub d: i64,
    pub c: i64,
    pub a: i64,
}

#[allow(dead_code, reason = "usati dalle viste in arrivo: struttura rosa di default e lettura per ruolo")]
impl RosterSlots {
    /// La struttura standard di FantaMaster: 3 portieri, 8 difensori,
    /// 8 centrocampisti, 6 attaccanti.
    pub const DEFAULT: Self = Self { p: 3, d: 8, c: 8, a: 6 };

    pub fn total(self) -> i64 {
        self.p + self.d + self.c + self.a
    }

    pub fn get(self, role: Role) -> i64 {
        match role {
            Role::P => self.p,
            Role::D => self.d,
            Role::C => self.c,
            Role::A => self.a,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Auction {
    pub id: i64,
    pub name: String,
    pub list_id: i64,
    pub budget: i64,
    pub slots: RosterSlots,
    pub created_at: String,
    pub status: AuctionStatus,
    pub is_simulation: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuctionStatus {
    Draft,
    Live,
    Closed,
}

impl AuctionStatus {
    pub fn parse(raw: &str) -> Result<Self> {
        match raw {
            "draft" => Ok(AuctionStatus::Draft),
            "live" => Ok(AuctionStatus::Live),
            "closed" => Ok(AuctionStatus::Closed),
            other => Err(AppError::invalid(format!("stato asta sconosciuto: {other}"))),
        }
    }
}

/// Un partecipante alla lega. Esattamente uno per asta ha `is_me` a true.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manager {
    pub id: i64,
    pub auction_id: i64,
    pub name: String,
    pub is_me: bool,
    pub order_index: i64,
}

/// Un giocatore assegnato a un partecipante, al prezzo battuto.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pick {
    pub id: i64,
    pub auction_id: i64,
    pub player_id: i64,
    pub manager_id: i64,
    pub price: i64,
    /// Ordine di assegnazione: serve ad annullare l'ultima e a leggere
    /// l'andamento del mercato nel tempo.
    pub seq: i64,
    pub picked_at: String,
}

/// Un'assegnazione con tutto quello che serve per mostrarla senza altre query.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PickDetail {
    pub id: i64,
    pub player_id: i64,
    pub player_name: String,
    pub serie_a_team: String,
    pub role: Role,
    pub quotation: i64,
    pub manager_id: i64,
    pub manager_name: String,
    pub is_mine: bool,
    pub price: i64,
    pub seq: i64,
}

/// Come sta messo un partecipante in questo momento. Tutto derivato dalle
/// assegnazioni: non c'è niente di simile salvato nel database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagerState {
    pub manager: Manager,
    pub spent: i64,
    pub credits_left: i64,
    /// Slot riempiti e ancora da riempire, reparto per reparto.
    pub filled: RosterSlots,
    pub missing: RosterSlots,
    pub slots_left: i64,
    /// Quanto può offrire lasciando un credito per ogni casella vuota.
    pub max_bid: i64,
    pub affordable_average: Option<f64>,
}

/// La fotografia dell'asta: alimenta dashboard, rose e sala asta.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuctionState {
    pub auction: Auction,
    pub managers: Vec<ManagerState>,
    pub picks_count: i64,
    pub total_paid: i64,
    /// Quotazioni di listino dei giocatori già assegnati: il metro con cui
    /// si misura quanto sta correndo il mercato.
    pub assigned_quotation: i64,
    pub inflation: Option<f64>,
    pub league_inflation: Option<f64>,
}
