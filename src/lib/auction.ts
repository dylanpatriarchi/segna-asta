/** Gli hook che ogni vista usa per sapere su quale asta sta lavorando. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, keys, type AuctionState } from "./api";

export function useActiveAuctionId() {
  return useQuery({ queryKey: keys.activeAuctionId, queryFn: api.activeAuctionId });
}

/** Lo stato dell'asta attiva, o `undefined` se non ce n'è una. */
export function useAuctionState(): {
  state: AuctionState | undefined;
  auctionId: number | null | undefined;
  isLoading: boolean;
} {
  const active = useActiveAuctionId();
  const auctionId = active.data ?? null;

  const state = useQuery({
    queryKey: keys.auctionState(auctionId ?? 0),
    queryFn: () => api.auctionState(auctionId as number),
    enabled: auctionId !== null,
  });

  return {
    state: state.data,
    auctionId: active.data,
    isLoading: active.isLoading || state.isLoading,
  };
}

/**
 * Dopo un'assegnazione cambia tutto insieme: crediti, slot, stato dei
 * giocatori nel listone. Si invalida in blocco, non pezzo per pezzo.
 */
export function useRefreshAuction(auctionId: number | null | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (auctionId == null) return;
    void queryClient.invalidateQueries({ queryKey: keys.auctionState(auctionId) });
    void queryClient.invalidateQueries({ queryKey: keys.picks(auctionId) });
  };
}

/** Il partecipante che sono io, se l'asta ce l'ha. */
export function myState(state: AuctionState | undefined) {
  return state?.managers.find((m) => m.manager.isMe);
}
