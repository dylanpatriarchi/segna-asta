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

export type WishEntry = {
  id: number;
  playerId: number;
  playerName: string;
  serieATeam: string;
  role: Role;
  quotation: number;
  targetPrice: number | null;
  maxBid: number | null;
  priority: number;
  groupLabel: string | null;
  notes: string | null;
  takenBy: string | null;
  takenPrice: number | null;
  takenByMe: boolean;
};

export type WishInput = {
  auctionId: number;
  playerId: number;
  targetPrice: number | null;
  maxBid: number | null;
  groupLabel: string | null;
  notes: string | null;
};

export type BudgetPlanEntry = { role: Role; targetPct: number };

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

  saveWish: (input: WishInput) => invoke<void>("save_wish", { input }),

  removeWish: (auctionId: number, playerId: number) =>
    invoke<void>("remove_wish", { auctionId, playerId }),

  moveWish: (auctionId: number, playerId: number, up: boolean) =>
    invoke<void>("move_wish", { auctionId, playerId, up }),

  wishlist: (auctionId: number) => invoke<WishEntry[]>("wishlist", { auctionId }),

  budgetPlan: (auctionId: number) => invoke<BudgetPlanEntry[]>("budget_plan", { auctionId }),

  setBudgetPlan: (auctionId: number, plan: BudgetPlanEntry[]) =>
    invoke<void>("set_budget_plan", { auctionId, plan }),

  backupDatabase: (path: string) => invoke<void>("backup_database", { path }),

  /** Restituisce dove è finita la copia di sicurezza dello stato precedente. */
  restoreDatabase: (path: string) => invoke<string>("restore_database", { path }),

  suggestedBackupName: () => invoke<string>("suggested_backup_name"),
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
  wishlist: (id: number) => ["wishlist", id] as const,
  budgetPlan: (id: number) => ["budgetPlan", id] as const,
};
