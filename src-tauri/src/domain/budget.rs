//! I conti che servono mentre l'asta corre.
//!
//! Tutto si calcola dai dati grezzi (crediti spesi, slot riempiti): nessuno
//! di questi valori viene salvato, così non esistono stati incoerenti.
//!
//! I chiamanti sono la sala asta e le analisi, che arrivano nelle milestone
//! successive; qui la logica è già scritta e coperta dai test.
#![allow(dead_code, reason = "chiamati dalla sala asta e dalle analisi, milestone successive")]

/// Quanto posso offrire su un giocatore lasciando almeno un credito per ogni
/// casella che resterebbe vuota. È il muro oltre il quale un rilancio mi
/// impedirebbe di completare la rosa.
///
/// `slots_left` include lo slot che sto per riempire con questa offerta.
pub fn max_bid(credits_left: i64, slots_left: i64) -> i64 {
    if slots_left <= 0 {
        // Rosa completa: non c'è nessuna offerta legittima da fare.
        return 0;
    }
    (credits_left - (slots_left - 1)).max(0)
}

/// Quanto posso spendere in media sugli slot che restano. Serve a capire se
/// il budget residuo regge ancora gli obiettivi in lista desideri.
pub fn affordable_average(credits_left: i64, slots_left: i64) -> Option<f64> {
    if slots_left <= 0 {
        return None;
    }
    Some(credits_left as f64 / slots_left as f64)
}

/// Il moltiplicatore medio pagato sul listino: sopra 1 il mercato sta correndo,
/// sotto 1 si stanno facendo affari. `None` finché non è stato assegnato nulla.
pub fn inflation(total_paid: i64, total_quotation: i64) -> Option<f64> {
    if total_quotation <= 0 {
        return None;
    }
    Some(total_paid as f64 / total_quotation as f64)
}

/// L'inflazione che la lega avrà per forza a fine asta: tutti i crediti in
/// gioco divisi per le quotazioni dei giocatori che *verranno* assegnati —
/// non di quelli già assegnati, altrimenti a inizio asta il rapporto sarebbe
/// enorme e non direbbe nulla.
///
/// È la riga di riferimento contro cui leggere l'inflazione corrente: sopra,
/// si sta pagando più di quanto la lega possa permettersi in media.
pub fn league_inflation(budget: i64, manager_count: i64, expected_quotation: i64) -> Option<f64> {
    if manager_count <= 0 {
        return None;
    }
    inflation(budget.saturating_mul(manager_count), expected_quotation)
}

/// Scostamento tra prezzo pagato e quotazione, in percentuale del listino.
/// Positivo = pagato più del listino.
pub fn deviation_pct(price: i64, quotation: i64) -> Option<f64> {
    if quotation <= 0 {
        return None;
    }
    Some((price - quotation) as f64 / quotation as f64 * 100.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn max_bid_riserva_un_credito_per_ogni_slot_rimanente() {
        // 100 crediti e 5 slot: ne tengo 4 da parte, posso offrirne 96.
        assert_eq!(max_bid(100, 5), 96);
    }

    #[test]
    fn max_bid_sull_ultimo_slot_lascia_offrire_tutto() {
        assert_eq!(max_bid(100, 1), 100);
    }

    #[test]
    fn max_bid_a_rosa_completa_e_zero() {
        assert_eq!(max_bid(100, 0), 0);
        assert_eq!(max_bid(100, -1), 0);
    }

    #[test]
    fn max_bid_non_va_sotto_zero_quando_i_crediti_non_bastano() {
        // Situazione da fine asta: 2 crediti per 5 slot. Non posso offrire nulla.
        assert_eq!(max_bid(2, 5), 0);
    }

    #[test]
    fn max_bid_a_budget_esaurito() {
        assert_eq!(max_bid(0, 3), 0);
    }

    #[test]
    fn media_sostenibile_e_indefinita_a_rosa_piena() {
        assert_eq!(affordable_average(50, 0), None);
        assert_eq!(affordable_average(50, 5), Some(10.0));
    }

    #[test]
    fn inflazione_indefinita_senza_assegnazioni() {
        assert_eq!(inflation(0, 0), None);
    }

    #[test]
    fn inflazione_sopra_uno_quando_il_mercato_corre() {
        // 120 crediti spesi su 100 di quotazioni: si paga il 20% in più.
        let value = inflation(120, 100).expect("quotazioni non nulle");
        assert!((value - 1.2).abs() < f64::EPSILON);
    }

    #[test]
    fn inflazione_di_lega_divide_i_crediti_per_le_quotazioni_attese() {
        // 8 partecipanti da 500 crediti (4000 in tutto) sui 200 giocatori che
        // finiranno assegnati, che di listino ne valgono 2500: 1.6 volte.
        let value = league_inflation(500, 8, 2500).expect("lega non vuota");
        assert!((value - 1.6).abs() < f64::EPSILON);
    }

    #[test]
    fn inflazione_di_lega_indefinita_senza_partecipanti() {
        assert_eq!(league_inflation(500, 0, 3702), None);
    }

    #[test]
    fn scostamento_positivo_se_ho_pagato_piu_del_listino() {
        assert_eq!(deviation_pct(30, 20), Some(50.0));
        assert_eq!(deviation_pct(10, 20), Some(-50.0));
        assert_eq!(deviation_pct(10, 0), None);
    }
}
