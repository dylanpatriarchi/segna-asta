/** Le sezioni dell'app, nell'ordine in cui compaiono in barra laterale. */
export const SECTIONS = [
  {
    id: "dashboard",
    label: "Dashboard",
    caption: "Lo stato dell'asta a colpo d'occhio",
  },
  {
    id: "listone",
    label: "Listone",
    caption: "Tutti gli svincolati, con stato e quotazione",
  },
  {
    id: "wishlist",
    label: "Lista desideri",
    caption: "Obiettivi per fascia, prezzo target e tetto d'offerta",
  },
  {
    id: "asta",
    label: "Sala asta",
    caption: "Segna le assegnazioni mentre l'asta corre",
  },
  {
    id: "rose",
    label: "Rose",
    caption: "La rosa di ogni partecipante, reparto per reparto",
  },
  {
    id: "analisi",
    label: "Analisi",
    caption: "Spesa, scostamenti, inflazione e crediti avversari",
  },
  {
    id: "impostazioni",
    label: "Impostazioni",
    caption: "Regole lega, partecipanti, listone e backup",
  },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
export type Section = (typeof SECTIONS)[number];

export function sectionById(id: SectionId): Section {
  const found = SECTIONS.find((s) => s.id === id);
  // SectionId deriva da SECTIONS, quindi il ramo è irraggiungibile a runtime.
  if (!found) throw new Error(`Sezione sconosciuta: ${id}`);
  return found;
}

/** Numerazione svizzera: 01, 02, 03… */
export function sectionNumber(id: SectionId): string {
  return String(SECTIONS.findIndex((s) => s.id === id) + 1).padStart(2, "0");
}
