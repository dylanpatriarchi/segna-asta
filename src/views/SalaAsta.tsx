import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, keys, type Player } from "@/lib/api";
import { useAuctionState, useRefreshAuction, myState } from "@/lib/auction";
import { AssignBar } from "@/components/AssignBar";
import { Button } from "@/components/Button";
import { Figure } from "@/components/Figure";
import { NoAuction } from "./Listone";
import shared from "@/styles/shared.module.css";
import styles from "./SalaAsta.module.css";

/** Quanti suggerimenti mostrare mentre si digita: oltre una manciata
 *  l'elenco smette di essere leggibile a colpo d'occhio. */
const MAX_SUGGESTIONS = 8;

export function SalaAsta() {
  const { state, auctionId } = useAuctionState();
  const refresh = useRefreshAuction(auctionId);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Player | null>(null);

  const listId = state?.auction.listId;

  const players = useQuery({
    queryKey: keys.players(listId ?? 0),
    queryFn: () => api.players(listId as number),
    enabled: listId !== undefined,
  });

  const picks = useQuery({
    queryKey: keys.picks(auctionId ?? 0),
    queryFn: () => api.picks(auctionId as number),
    enabled: auctionId != null,
  });

  const undo = useMutation({
    mutationFn: () => api.undoLastPick(auctionId as number),
    onSuccess: refresh,
  });

  const taken = useMemo(
    () => new Set((picks.data ?? []).map((p) => p.playerId)),
    [picks.data],
  );

  const suggestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length < 2) return [];
    return (players.data ?? [])
      .filter((p) => !taken.has(p.id) && p.name.toLowerCase().includes(needle))
      .slice(0, MAX_SUGGESTIONS);
  }, [players.data, search, taken]);

  if (!state) return <NoAuction />;

  const me = myState(state);
  const recent = [...(picks.data ?? [])].reverse().slice(0, 12);

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.searchRow}>
          <input
            className={`${shared.input} ${styles.search}`}
            placeholder="Chi è stato chiamato?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              // Invio sul primo risultato: durante l'asta si digita e si conferma
              // senza staccare le mani dalla tastiera.
              if (e.key === "Enter" && suggestions[0]) {
                setSelected(suggestions[0]);
                setSearch("");
              }
            }}
            autoFocus
          />
          <Button
            variant="secondary"
            onClick={() => undo.mutate()}
            disabled={undo.isPending || (picks.data?.length ?? 0) === 0}
          >
            Annulla ultima
          </Button>
        </div>

        {suggestions.length > 0 && (
          <ul className={styles.suggestions}>
            {suggestions.map((player) => (
              <li key={player.id}>
                <button
                  type="button"
                  className={styles.suggestion}
                  onClick={() => {
                    setSelected(player);
                    setSearch("");
                  }}
                >
                  <span className={shared.strong}>{player.name}</span>
                  <span className={shared.muted}>
                    {player.serieATeam} · {player.role}
                  </span>
                  <span className={shared.numeric}>{player.quotation}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <section className={shared.block}>
          <div className={shared.blockHead}>
            <span className="eyebrow">Ultime assegnazioni</span>
          </div>
          {recent.length === 0 ? (
            <p className={shared.empty}>Non è ancora stato assegnato nessuno.</p>
          ) : (
            <table className={shared.table}>
              <thead>
                <tr>
                  <th className={shared.numeric}>#</th>
                  <th>Giocatore</th>
                  <th>Ruolo</th>
                  <th>A</th>
                  <th className={shared.numeric}>Prezzo</th>
                  <th className={shared.numeric}>Quot.</th>
                  <th className={shared.numeric}>Scarto</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((pick) => {
                  const delta = pick.price - pick.quotation;
                  return (
                    <tr key={pick.id}>
                      <td className={`${shared.numeric} ${shared.muted}`}>{pick.seq}</td>
                      <td className={shared.strong}>{pick.playerName}</td>
                      <td className={shared.muted}>{pick.role}</td>
                      <td className={pick.isMine ? shared.strong : shared.muted}>
                        {pick.isMine ? "Io" : pick.managerName}
                      </td>
                      <td className={shared.numeric}>{pick.price}</td>
                      <td className={`${shared.numeric} ${shared.muted}`}>{pick.quotation}</td>
                      <td className={`${shared.numeric} ${delta > 0 ? shared.negative : ""}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <aside className={styles.side}>
        {me && (
          <>
            <div className={styles.sideBlock}>
              <span className="eyebrow">Io</span>
              <div className={styles.bigNumber}>{me.maxBid}</div>
              <div className={shared.figureLabel}>massimo che posso offrire</div>
            </div>
            <div className={shared.figures}>
              <Figure value={me.creditsLeft} label="Crediti" alert={me.creditsLeft < 0} />
              <Figure value={me.slotsLeft} label="Slot liberi" />
            </div>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Reparto</th>
                  <th className={shared.numeric}>Presi</th>
                  <th className={shared.numeric}>Mancano</th>
                </tr>
              </thead>
              <tbody>
                {(["p", "d", "c", "a"] as const).map((role) => (
                  <tr key={role}>
                    <td>{role.toUpperCase()}</td>
                    <td className={shared.numeric}>{me.filled[role]}</td>
                    <td className={shared.numeric}>{me.missing[role]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className={styles.sideBlock}>
          <span className="eyebrow">Avversari</span>
          <table className={shared.table}>
            <tbody>
              {state.managers
                .filter((m) => !m.manager.isMe)
                .map((m) => (
                  <tr key={m.manager.id}>
                    <td>{m.manager.name}</td>
                    <td className={shared.numeric}>{m.creditsLeft}</td>
                    <td className={`${shared.numeric} ${shared.muted}`}>{m.slotsLeft} slot</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </aside>

      {selected && (
        <AssignBar
          player={selected}
          state={state}
          onDone={() => setSelected(null)}
          onCancel={() => setSelected(null)}
        />
      )}
    </div>
  );
}
