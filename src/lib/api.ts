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

export type Pick = {
  id: number;
  auctionId: number;
  playerId: number;
  managerId: number;
  price: number;
  seq: number;
  pickedAt: string;
};

/** Un'assegnazione con tutto il necessario per mostrarla senza altre query. */
export type PickDetail = {
  id: number;
  playerId: number;
  playerName: string;
  serieATeam: string;
  role: Role;
  quotation: number;
  managerId: number;
  managerName: string;
  isMine: boolean;
  price: number;
  seq: number;
};

export type ManagerState = {
  manager: Manager;
  spent: number;
  creditsLeft: number;
  filled: RosterSlots;
  missing: RosterSlots;
  slotsLeft: number;
  maxBid: number;
  affordableAverage: number | null;
};

export type AuctionState = {
  auction: Auction;
  managers: ManagerState[];
  picksCount: number;
  totalPaid: number;
  assignedQuotation: number;
  inflation: number | null;
  leagueInflation: number | null;
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

  assignPlayer: (auctionId: number, playerId: number, managerId: number, price: number) =>
    invoke<Pick>("assign_player", { auctionId, playerId, managerId, price }),

  undoLastPick: (auctionId: number) =>
    invoke<PickDetail | null>("undo_last_pick", { auctionId }),

  picks: (auctionId: number) => invoke<PickDetail[]>("picks", { auctionId }),

  auctionState: (auctionId: number) => invoke<AuctionState>("auction_state", { auctionId }),

  activeAuctionId: () => invoke<number | null>("active_auction_id"),

  setActiveAuction: (auctionId: number) =>
    invoke<void>("set_active_auction", { auctionId }),
};

/** Le chiavi delle query, in un posto solo: invalidarne una a caso è il modo
 *  più veloce per ritrovarsi numeri vecchi a schermo durante l'asta. */
export const keys = {
  playerLists: ["playerLists"] as const,
  auctions: ["auctions"] as const,
  activeAuctionId: ["activeAuctionId"] as const,
  auctionState: (id: number) => ["auctionState", id] as const,
  picks: (id: number) => ["picks", id] as const,
  players: (listId: number, filter?: PlayerFilter) => ["players", listId, filter] as const,
  teams: (listId: number) => ["teams", listId] as const,
};
