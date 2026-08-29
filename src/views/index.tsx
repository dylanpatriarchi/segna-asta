import { Placeholder } from "@/components/Placeholder";
import type { SectionId } from "@/app/navigation";

/**
 * Contenuti delle sezioni. Ogni voce viene sostituita dalla vista vera
 * nella milestone che la riguarda; qui resta ciò che dovrà contenere.
 */
const CONTENT: Record<SectionId, { title: string; body: string; items: string[] }> = {
  dashboard: {
    title: "Il quadro della mia asta",
    body: "Crediti, slot e obiettivi in un'unica schermata, aggiornati a ogni assegnazione.",
    items: [
      "Crediti residui e max bid disponibile",
      "Slot ancora da riempire per reparto",
      "Prossimi obiettivi di lista desideri ancora liberi",
      "Ultimi movimenti della lega",
    ],
  },
  listone: {
    title: "608 svincolati, filtrabili",
    body: "Il listone importato da XLSX, con ricerca e stato di ogni giocatore.",
    items: [
      "Ricerca per nome, filtri per ruolo, squadra e fascia di quotazione",
      "Stato: libero, in lista desideri, preso da me, preso da un avversario",
      "Aggiunta alla lista desideri o assegnazione diretta",
    ],
  },
  wishlist: {
    title: "Gli obiettivi, in ordine di priorità",
    body: "Per ogni giocatore che voglio: quanto penso valga e oltre quanto non vado.",
    items: [
      "Fasce: Top, Buono, Ripiego, Scommessa",
      "Prezzo target e tetto massimo d'offerta",
      "Gruppi di alternative intercambiabili",
      "Somma dei target confrontata col budget e col piano di reparto",
    ],
  },
  asta: {
    title: "La schermata da tenere aperta durante l'asta",
    body: "Pensata per la velocità: cerchi, assegni, e se sbagli torni indietro in un tasto.",
    items: [
      "Assegnazione rapida da tastiera: nome, partecipante, prezzo, Invio",
      "Annulla e ripristina sulle ultime assegnazioni",
      "Max bid consigliato sempre in vista",
      "Avviso quando il prezzo supera il mio tetto di lista desideri",
    ],
  },
  rose: {
    title: "Chi ha preso cosa",
    body: "Le rose di tutti i partecipanti, con prezzi pagati e totali di reparto.",
    items: [
      "Griglia per reparto di ogni partecipante",
      "La mia rosa in evidenza",
      "Spesa e slot residui per ciascuno",
    ],
  },
  analisi: {
    title: "Le quattro letture del mercato",
    body: "Grafici essenziali per capire dove sto spendendo e come si muove la lega.",
    items: [
      "Budget e spesa per ruolo, contro il piano",
      "Scostamento tra prezzo pagato e quotazione",
      "Inflazione del mercato durante l'asta",
      "Crediti residui e slot mancanti degli avversari",
    ],
  },
  impostazioni: {
    title: "Regole, dati e manutenzione",
    body: "Tutto ciò che si configura una volta e poi si dimentica.",
    items: [
      "Crediti, struttura rosa e partecipanti della lega",
      "Import e aggiornamento del listone da XLSX",
      "Export CSV/JSON della rosa e backup del database",
      "Aste archiviate: asta vera, simulazioni, stagioni passate",
    ],
  },
};

export function SectionView({ section }: { section: SectionId }) {
  const content = CONTENT[section];
  return <Placeholder {...content} />;
}
