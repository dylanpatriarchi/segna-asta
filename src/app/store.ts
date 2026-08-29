import { create } from "zustand";
import type { SectionId } from "./navigation";

type UiState = {
  section: SectionId;
  goTo: (section: SectionId) => void;
};

/** Stato effimero dell'interfaccia: non tocca il database. */
export const useUi = create<UiState>((set) => ({
  section: "dashboard",
  goTo: (section) => set({ section }),
}));
