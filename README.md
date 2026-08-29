# Segna-Asta

Tool desktop per l'asta del fantacalcio. Listone, lista desideri e tracciamento
live dell'asta in un'unica app nativa, con database SQLite locale.

Risponde alla sola domanda che conta durante un'asta: **fino a quanto posso
spingermi su questo giocatore, adesso?**

## Cosa fa

- Importa il listone svincolati da XLSX (formato FantaMaster) in SQLite
- Lista desideri con fasce, prezzo target e tetto massimo di offerta
- Tracciamento di **ogni** assegnazione della lega, non solo delle proprie
- Max bid consigliato in tempo reale, calcolato su crediti e slot residui
- Analisi: spesa per reparto, scostamento prezzo/quotazione, inflazione di
  mercato live, crediti residui di ogni avversario
- Più aste archiviate: asta vera, simulazioni di prova, stagioni passate

## Stack

Tauri 2 · Rust · SQLite (rusqlite) · React 19 · TypeScript · Vite

La logica di dominio vive nel backend Rust ed è esposta come comandi Tauri
tipizzati; il frontend non scrive SQL.

## Sviluppo

```bash
npm install
npm run tauri dev
```

Requisiti: Node 20+, Rust stable, toolchain Tauri per la propria piattaforma.

## Dati

`data/quotazioni_fantamaster.xlsx` è il listone di riferimento usato per lo
sviluppo e per i test di regressione dell'importer: 608 giocatori, 20 squadre,
ruoli classic P/D/C/A, somma quotazioni 3702.
