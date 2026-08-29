import { Dashboard } from "./Dashboard";
import { Listone } from "./Listone";
import { SalaAsta } from "./SalaAsta";
import { Rose } from "./Rose";
import { Wishlist } from "./Wishlist";
import { Analisi } from "./Analisi";
import { Impostazioni } from "./Impostazioni";
import type { SectionId } from "@/app/navigation";

/** Ogni sezione ha ormai la sua vista: lo switch è esaustivo, e il tipo
 *  lo garantisce se un domani se ne aggiunge una. */
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
    case "analisi":
      return <Analisi />;
    case "impostazioni":
      return <Impostazioni />;
  }
}
