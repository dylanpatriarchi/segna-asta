import { Placeholder } from "@/components/Placeholder";
import { Impostazioni } from "./Impostazioni";
import type { SectionId } from "@/app/navigation";

/**
 * Cosa conterrà ogni sezione. Ogni voce viene sostituita dalla vista vera
 * nella milestone che la riguarda.
 */
const CONTENT: Record<SectionId, string[]> = {
  dashboard: [
    "Crediti residui e max bid disponibile",
    "Slot ancora da riempire per reparto",
    "Prossimi obiettivi di lista desideri ancora liberi",
    "Ultimi movimenti della lega",
  ],
  listone: [
    "Ricerca per nome, filtri per ruolo, squadra e fascia di quotazione",
    "Stato: libero, in lista desideri, preso da me, preso da un avversario",
    "Aggiunta alla lista desideri o assegnazione diretta",
  ],
  wishlist: [
    "Fasce: Top, Buono, Ripiego, Scommessa",
    "Prezzo target e tetto massimo d'offerta",
    "Gruppi di alternative intercambiabili",
    "Somma dei target confrontata col budget e col piano di reparto",
  ],
  asta: [
    "Assegnazione rapida da tastiera: nome, partecipante, prezzo, Invio",
    "Annulla e ripristina sulle ultime assegnazioni",
    "Max bid consigliato sempre in vista",
    "Avviso quando il prezzo supera il mio tetto di lista desideri",
  ],
  rose: [
    "Griglia per reparto di ogni partecipante",
    "La mia rosa in evidenza",
    "Spesa e slot residui per ciascuno",
  ],
  analisi: [
    "Budget e spesa per ruolo, contro il piano",
    "Scostamento tra prezzo pagato e quotazione",
    "Inflazione del mercato durante l'asta",
    "Crediti residui e slot mancanti degli avversari",
  ],
  // Impostazioni ha già la sua vista: qui resta solo per completezza del tipo.
  impostazioni: [],
};

export function SectionView({ section }: { section: SectionId }) {
  if (section === "impostazioni") return <Impostazioni />;
  return <Placeholder items={CONTENT[section]} />;
}
