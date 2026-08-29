/** Le sezioni dell'app, nell'ordine in cui compaiono in barra laterale. */
export const SECTIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "listone", label: "Listone" },
  { id: "wishlist", label: "Lista desideri" },
  { id: "asta", label: "Sala asta" },
  { id: "rose", label: "Rose" },
  { id: "analisi", label: "Analisi" },
  { id: "impostazioni", label: "Impostazioni" },
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
