import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, keys, ROLES, ROLE_LABEL, type Player, type WishEntry } from "@/lib/api";
import { useAuctionState, myState } from "@/lib/auction";
import { Figure } from "@/components/Figure";
import { NoAuction } from "./Listone";
import shared from "@/styles/shared.module.css";
import styles from "./Wishlist.module.css";

export function Wishlist() {
  const { state, auctionId } = useAuctionState();
  const queryClient = useQueryClient();

  const wishes = useQuery({
    queryKey: keys.wishlist(auctionId ?? 0),
    queryFn: () => api.wishlist(auctionId as number),
    enabled: auctionId != null,
  });

  const refresh = () => {
    if (auctionId != null) {
      void queryClient.invalidateQueries({ queryKey: keys.wishlist(auctionId) });
    }
  };

  if (!state) return <NoAuction />;

  const entries = wishes.data ?? [];
  const me = myState(state);
  // Quello che gli obiettivi ancora liberi mi costerebbero al prezzo che ho
  // in mente: è il numero che dice se la lista sta in piedi o è un sogno.
  const openEntries = entries.filter((e) => e.takenBy === null);
  const committed = openEntries.reduce((sum, e) => sum + (e.targetPrice ?? e.quotation), 0);
  const budgetLeft = me?.creditsLeft ?? state.auction.budget;
  const overCommitted = committed > budgetLeft;

  return (
    <div className={styles.page}>
      <section className={shared.block}>
        <div className={shared.blockHead}>
          <span className="eyebrow">Quanto mi costerebbe la lista</span>
          <span className={shared.muted}>{openEntries.length} obiettivi ancora liberi</span>
        </div>
        <div className={shared.figures}>
          <Figure value={committed} label="Somma dei target" alert={overCommitted} />
          <Figure value={budgetLeft} label="Crediti disponibili" />
          <Figure
            value={budgetLeft - committed}
            label="Margine"
            alert={overCommitted}
          />
        </div>
        {overCommitted && (
          <p className={shared.error}>
            I target superano i crediti di {committed - budgetLeft}: qualcosa
            dovrà saltare, meglio deciderlo adesso che durante l'asta.
          </p>
        )}
      </section>

      <BudgetPlan auctionId={state.auction.id} budget={state.auction.budget} />

      <AddTarget auctionId={state.auction.id} listId={state.auction.listId} onAdded={refresh} />

      {ROLES.map((role) => {
        const inRole = entries.filter((e) => e.role === role);
        if (inRole.length === 0) return null;
        // Contano solo gli obiettivi ancora liberi: quelli già andati a
        // qualcuno non costano più niente, e sommarli gonfierebbe il totale.
        const stillOpen = inRole.filter((e) => e.takenBy === null);
        const roleTarget = stillOpen.reduce(
          (sum, e) => sum + (e.targetPrice ?? e.quotation),
          0,
        );
        return (
          <section key={role} className={shared.block}>
            <div className={shared.blockHead}>
              <span className="eyebrow">{ROLE_LABEL[role]}</span>
              <span className={shared.muted}>
                {stillOpen.length} da prendere · {roleTarget} crediti di target
              </span>
            </div>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Giocatore</th>
                  <th className={shared.numeric}>Quot.</th>
                  <th className={shared.numeric}>Target</th>
                  <th className={shared.numeric}>Non oltre</th>
                  <th>Gruppo</th>
                  <th>Stato</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {inRole.map((entry) => (
                  <WishRow
                    key={entry.id}
                    entry={entry}
                    auctionId={state.auction.id}
                    onChanged={refresh}
                  />
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {entries.length === 0 && (
        <p className={shared.empty}>
          Nessun obiettivo. Aggiungi i giocatori che vuoi davvero, con quanto
          pensi valgano e oltre quanto non vuoi andare: si dispongono da soli
          nel loro reparto.
        </p>
      )}
    </div>
  );
}

function WishRow({
  entry,
  auctionId,
  onChanged,
}: {
  entry: WishEntry;
  auctionId: number;
  onChanged: () => void;
}) {
  const save = useMutation({
    mutationFn: (patch: Partial<{ targetPrice: number | null; maxBid: number | null }>) =>
      api.saveWish({
        auctionId,
        playerId: entry.playerId,
        targetPrice: entry.targetPrice,
        maxBid: entry.maxBid,
        groupLabel: entry.groupLabel,
        notes: entry.notes,
        ...patch,
      }),
    onSuccess: onChanged,
  });

  const remove = useMutation({
    mutationFn: () => api.removeWish(auctionId, entry.playerId),
    onSuccess: onChanged,
  });

  const move = useMutation({
    mutationFn: (up: boolean) => api.moveWish(auctionId, entry.playerId, up),
    onSuccess: onChanged,
  });

  const taken = entry.takenBy !== null;

  return (
    <tr className={taken ? styles.taken : undefined}>
      <td className={shared.strong}>
        {entry.playerName}
        <span className={shared.muted}> · {entry.serieATeam}</span>
      </td>
      <td className={`${shared.numeric} ${shared.muted}`}>{entry.quotation}</td>
      <td className={shared.numeric}>
        <NumberCell
          value={entry.targetPrice}
          onCommit={(targetPrice) => save.mutate({ targetPrice })}
        />
      </td>
      <td className={shared.numeric}>
        <NumberCell
          value={entry.maxBid}
          onCommit={(maxBid) => save.mutate({ maxBid })}
        />
      </td>
      <td className={shared.muted}>{entry.groupLabel ?? ""}</td>
      <td className={taken ? shared.negative : shared.muted}>
        {taken
          ? `${entry.takenByMe ? "preso da me" : entry.takenBy} · ${entry.takenPrice}`
          : "libero"}
      </td>
      <td>
        {/* Il flex sta in un div: applicato al td toglierebbe la cella dal
            flusso della riga e le altezze si sfalserebbero. */}
        <div className={styles.rowActions}>
          <button type="button" className={styles.iconButton} onClick={() => move.mutate(true)}>
            ↑
          </button>
          <button type="button" className={styles.iconButton} onClick={() => move.mutate(false)}>
            ↓
          </button>
          <button type="button" className={styles.iconButton} onClick={() => remove.mutate()}>
            ×
          </button>
        </div>
      </td>
    </tr>
  );
}

/** Cella numerica che salva quando si esce dal campo o si preme Invio:
 *  scrivere un prezzo non deve costare un click su un pulsante. */
function NumberCell({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  const commit = () => {
    const next = draft.trim() === "" ? null : Number(draft);
    if (next !== value) onCommit(Number.isNaN(next) ? null : next);
  };

  return (
    <input
      className={styles.cellInput}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      inputMode="numeric"
      placeholder="—"
    />
  );
}

function AddTarget({
  auctionId,
  listId,
  onAdded,
}: {
  auctionId: number;
  listId: number;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");

  const players = useQuery({
    queryKey: keys.players(listId),
    queryFn: () => api.players(listId),
  });

  const wishes = useQuery({
    queryKey: keys.wishlist(auctionId),
    queryFn: () => api.wishlist(auctionId),
  });

  const alreadyIn = useMemo(
    () => new Set((wishes.data ?? []).map((w) => w.playerId)),
    [wishes.data],
  );

  const suggestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length < 2) return [];
    return (players.data ?? [])
      .filter((p) => !alreadyIn.has(p.id) && p.name.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [players.data, search, alreadyIn]);

  const add = useMutation({
    mutationFn: (player: Player) =>
      api.saveWish({
        auctionId,
        playerId: player.id,
        // La quotazione è il punto di partenza: si corregge scrivendoci sopra.
        targetPrice: player.quotation,
        maxBid: null,
        groupLabel: group.trim() === "" ? null : group.trim(),
        notes: null,
      }),
    onSuccess: () => {
      setSearch("");
      onAdded();
    },
  });

  return (
    <section className={shared.block}>
      <div className={shared.blockHead}>
        <span className="eyebrow">Aggiungi un obiettivo</span>
      </div>
      <div className={shared.row}>
        <input
          className={`${shared.input} ${styles.search}`}
          placeholder="Cerca un giocatore…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions[0]) add.mutate(suggestions[0]);
          }}
        />
        <label className={shared.field}>
          <span className={shared.label}>Gruppo di alternative</span>
          <input
            className={`${shared.input} ${styles.group}`}
            placeholder="es. regista"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          />
        </label>
      </div>
      {suggestions.length > 0 && (
        <ul className={styles.suggestions}>
          {suggestions.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                className={styles.suggestion}
                onClick={() => add.mutate(player)}
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
    </section>
  );
}

/** Come intendo spartire il budget fra i reparti: le quote si scrivono in
 *  percentuale e si vedono subito tradotte in crediti. */
function BudgetPlan({ auctionId, budget }: { auctionId: number; budget: number }) {
  const queryClient = useQueryClient();
  const plan = useQuery({
    queryKey: keys.budgetPlan(auctionId),
    queryFn: () => api.budgetPlan(auctionId),
  });

  const save = useMutation({
    mutationFn: (next: { role: (typeof ROLES)[number]; targetPct: number }[]) =>
      api.setBudgetPlan(auctionId, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.budgetPlan(auctionId) }),
  });

  const entries = plan.data ?? [];
  const total = entries.reduce((sum, e) => sum + e.targetPct, 0);

  return (
    <section className={shared.block}>
      <div className={shared.blockHead}>
        <span className="eyebrow">Piano di spesa</span>
        <span className={Math.abs(total - 100) > 0.01 ? shared.error : shared.muted}>
          {total.toFixed(0)}%
        </span>
      </div>
      <div className={styles.planRow}>
        {ROLES.map((role) => {
          const entry = entries.find((e) => e.role === role);
          const pct = entry?.targetPct ?? 0;
          return (
            <label key={role} className={shared.field}>
              <span className={shared.label}>{ROLE_LABEL[role]}</span>
              <div className={styles.planInput}>
                <input
                  className={`${shared.input} ${styles.pct}`}
                  type="number"
                  min={0}
                  value={pct}
                  onChange={(e) =>
                    save.mutate(
                      ROLES.map((r) => ({
                        role: r,
                        targetPct:
                          r === role
                            ? Number(e.target.value)
                            : (entries.find((x) => x.role === r)?.targetPct ?? 0),
                      })),
                    )
                  }
                />
                <span className={shared.muted}>
                  {Math.round((budget * pct) / 100)} cr
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}
