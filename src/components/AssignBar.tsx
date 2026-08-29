import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, type AuctionState, type Player } from "@/lib/api";
import { useRefreshAuction } from "@/lib/auction";
import { Button } from "@/components/Button";
import shared from "@/styles/shared.module.css";
import styles from "./AssignBar.module.css";

/**
 * La barra con cui si segna un'assegnazione. Si apre selezionando un
 * giocatore e si usa senza mouse: il prezzo è già a fuoco, Invio conferma,
 * Esc chiude.
 */
export function AssignBar({
  player,
  state,
  onDone,
  onCancel,
}: {
  player: Player;
  state: AuctionState;
  onDone: () => void;
  onCancel: () => void;
}) {
  const refresh = useRefreshAuction(state.auction.id);
  const me = state.managers.find((m) => m.manager.isMe);
  const [managerId, setManagerId] = useState(me?.manager.id ?? state.managers[0]?.manager.id ?? 0);
  const [price, setPrice] = useState<string>(String(player.quotation));
  const priceInput = useRef<HTMLInputElement>(null);

  // Cambiando giocatore la barra riparte pulita, con la quotazione come
  // prima proposta di prezzo e il campo pronto per essere sovrascritto.
  useEffect(() => {
    setPrice(String(player.quotation));
    priceInput.current?.focus();
    priceInput.current?.select();
  }, [player.id, player.quotation]);

  const assign = useMutation({
    mutationFn: () =>
      api.assignPlayer(state.auction.id, player.id, managerId, Number(price) || 0),
    onSuccess: () => {
      refresh();
      onDone();
    },
  });

  const buyer = state.managers.find((m) => m.manager.id === managerId);
  const numericPrice = Number(price) || 0;
  // Oltre il max bid il partecipante non può più completare la rosa: si può
  // registrare lo stesso, ma va detto forte.
  const overBudget = buyer !== undefined && numericPrice > buyer.maxBid;

  return (
    <div
      className={styles.bar}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !assign.isPending) assign.mutate();
        if (event.key === "Escape") onCancel();
      }}
    >
      <div className={styles.player}>
        <span className={styles.name}>{player.name}</span>
        <span className={shared.muted}>
          {player.serieATeam} · {player.role} · quotazione {player.quotation}
        </span>
      </div>

      <label className={shared.field}>
        <span className={shared.label}>A chi</span>
        <select
          className={shared.select}
          value={managerId}
          onChange={(e) => setManagerId(Number(e.target.value))}
        >
          {state.managers.map((m) => (
            <option key={m.manager.id} value={m.manager.id}>
              {m.manager.name}
              {m.manager.isMe ? " (io)" : ""} · {m.creditsLeft} cr
            </option>
          ))}
        </select>
      </label>

      <label className={shared.field}>
        <span className={shared.label}>Prezzo</span>
        <input
          ref={priceInput}
          className={`${shared.input} ${styles.price}`}
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>

      <div className={styles.hint}>
        {buyer && (
          <>
            <span className={overBudget ? shared.negative : undefined}>
              max {buyer.maxBid}
            </span>
            <span className={shared.muted}>
              {buyer.slotsLeft} slot · {buyer.creditsLeft} cr
            </span>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <Button onClick={() => assign.mutate()} disabled={assign.isPending}>
          Assegna
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Annulla
        </Button>
      </div>

      {assign.isError && <span className={shared.error}>{String(assign.error)}</span>}
    </div>
  );
}
