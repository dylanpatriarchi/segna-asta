import { Placeholder } from "@/components/Placeholder";
import { Dashboard } from "./Dashboard";
import { Listone } from "./Listone";
import { SalaAsta } from "./SalaAsta";
import { Rose } from "./Rose";
import { Wishlist } from "./Wishlist";
import { Impostazioni } from "./Impostazioni";
import type { SectionId } from "@/app/navigation";

/** Cosa conterranno le sezioni non ancora costruite. */
const IN_ARRIVO: Partial<Record<SectionId, string[]>> = {
  analisi: [
    "Budget e spesa per ruolo, contro il piano",
    "Scostamento tra prezzo pagato e quotazione",
    "Inflazione del mercato durante l'asta",
    "Crediti residui e slot mancanti degli avversari",
  ],
};

export function SectionView({ section }: { section: SectionId }) {
  switch (section) {
    case "dashboard":
      return <Dashboard />;
    case "listone":
      return <Listone />;
    case "asta":
      return <SalaAsta />;
    case "rose":
      return <Rose />;
    case "wishlist":
      return <Wishlist />;
    case "impostazioni":
      return <Impostazioni />;
    default:
      return <Placeholder items={IN_ARRIVO[section] ?? []} />;
  }
}
