/**
 * L'unico punto di contatto col backend Rust. I tipi qui rispecchiano quelli
 * di `src-tauri/src/domain`: se cambiano di là, vanno cambiati di qua.
 */
import { invoke } from "@tauri-apps/api/core";

export type Role = "P" | "D" | "C" | "A";

export const ROLES: Role[] = ["P", "D", "C", "A"];

export const ROLE_LABEL: Record<Role, string> = {
  P: "Portieri",
  D: "Difensori",
  C: "Centrocampisti",
  A: "Attaccanti",
};

export type PlayerList = {
  id: number;
  label: string;
  sourceFile: string;
  importedAt: string;
  playerCount: number;
};

export type Player = {
  id: number;
  listId: number;
  name: string;
  serieATeam: string;
  role: Role;
  quotation: number;
};

export type RosterSlots = { p: number; d: number; c: number; a: number };

export type AuctionStatus = "draft" | "live" | "closed";

export type Auction = {
  id: number;
  name: string;
  listId: number;
  budget: number;
  slots: RosterSlots;
  createdAt: string;
  status: AuctionStatus;
  isSimulation: boolean;
};

export type Manager = {
  id: number;
  auctionId: number;
  name: string;
  isMe: boolean;
  orderIndex: number;
};

export type ImportReport = {
  list: PlayerList;
  byRole: { role: Role; count: number }[];
  teamCount: number;
  totalQuotation: number;
};

export type PlayerFilter = {
  search?: string;
  role?: Role;
  team?: string;
};

export type NewAuction = {
  name: string;
  listId: number;
  budget: number;
  slots: RosterSlots;
  isSimulation: boolean;
  managers: string[];
  myIndex: number;
};

export const api = {
  importPlayerList: (path: string, label?: string) =>
    invoke<ImportReport>("import_player_list", { path, label: label ?? null }),

  playerLists: () => invoke<PlayerList[]>("player_lists"),

  latestPlayerList: () => invoke<PlayerList | null>("latest_player_list"),

  players: (listId: number, filter?: PlayerFilter) =>
    invoke<Player[]>("players", { listId, filter: filter ?? null }),

  teams: (listId: number) => invoke<string[]>("teams", { listId }),

  createAuction: (request: NewAuction) => invoke<Auction>("create_auction", { request }),

  auctions: () => invoke<Auction[]>("auctions"),

  auction: (id: number) => invoke<Auction>("auction", { id }),

  managers: (auctionId: number) => invoke<Manager[]>("managers", { auctionId }),
};
