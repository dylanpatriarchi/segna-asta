import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, keys, ROLE_LABEL, type PickDetail } from "@/lib/api";
import { useAuctionState, myState } from "@/lib/auction";
import { SpesaPerReparto, spesaPerRepartoRows } from "@/components/charts/SpesaPerReparto";
import { Scostamenti } from "@/components/charts/Scostamenti";
import { Inflazione } from "@/components/charts/Inflazione";
import { CreditiAvversari } from "@/components/charts/CreditiAvversari";
import { Button } from "@/components/Button";
import { NoAuction } from "./Listone";
import shared from "@/styles/shared.module.css";
import styles from "./Analisi.module.css";

export function Analisi() {
  const { state, auctionId } = useAuctionState();
  // Ogni grafico ha la sua tabella: chi preferisce i numeri, o non
  // distingue i colori, non deve rinunciare all'informazione.
  const [showTables, setShowTables] = useState(false);

  const picks = useQuery({
    queryKey: keys.picks(auctionId ?? 0),
    queryFn: () => api.picks(auctionId as number),
    enabled: auctionId != null,
  });

  const plan = useQuery({
    queryKey: keys.budgetPlan(auctionId ?? 0),
    queryFn: () => api.budgetPlan(auctionId as number),
    enabled: auctionId != null,
  });

  if (!state) return <NoAuction />;

  const allPicks = picks.data ?? [];
  const myPicks = allPicks.filter((p) => p.isMine);
  const me = myState(state);

  if (allPicks.length === 0) {
    return (
      <div className={styles.page}>
        <p className={shared.empty}>
          I grafici si popolano man mano che segni le assegnazioni: al momento
          non ce n'è nessuna.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <Button variant="secondary" onClick={() => setShowTables((v) => !v)}>
          {showTables ? "Mostra i grafici" : "Mostra i numeri"}
        </Button>
      </div>

      <section className={shared.block}>
        <div className={shared.blockHead}>
          <span className="eyebrow">La mia spesa per reparto</span>
          <span className={shared.muted}>{me?.spent ?? 0} crediti spesi</span>
        </div>
        {showTables ? (
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Reparto</th>
                <th className={shared.numeric}>Speso</th>
                <th className={shared.numeric}>Piano</th>
                <th className={shared.numeric}>Scarto</th>
              </tr>
            </thead>
            <tbody>
              {spesaPerRepartoRows(myPicks, plan.data ?? [], state.auction.budget).map((row) => (
                <tr key={row.role}>
                  <td>{ROLE_LABEL[row.role]}</td>
                  <td className={shared.numeric}>{row.spent}</td>
                  <td className={shared.numeric}>{row.planned}</td>
                  <td
                    className={`${shared.numeric} ${row.spent > row.planned ? shared.negative : ""}`}
                  >
                    {row.spent - row.planned > 0 ? "+" : ""}
                    {row.spent - row.planned}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <SpesaPerReparto
            picks={myPicks}
            plan={plan.data ?? []}
            budget={state.auction.budget}
          />
        )}
      </section>

      <section className={shared.block}>
        <div className={shared.blockHead}>
          <span className="eyebrow">Chi ha pagato troppo</span>
          <span className={shared.muted}>tutta la lega</span>
        </div>
        {showTables ? (
          <DeviationTable picks={allPicks} />
        ) : (
          <Scostamenti picks={allPicks} />
        )}
      </section>

      <section className={shared.block}>
        <div className={shared.blockHead}>
          <span className="eyebrow">Come si muove il mercato</span>
          <span className={shared.muted}>
            {state.inflation === null ? "—" : `${state.inflation.toFixed(2)}×`} corrente
          </span>
        </div>
        {showTables ? (
          <p className={shared.blockBody}>
            Si è pagato {state.totalPaid} crediti per giocatori che di listino
            ne valgono {state.assignedQuotation}: un moltiplicatore di{" "}
            {state.inflation?.toFixed(2) ?? "—"}×, contro un riferimento di lega
            di {state.leagueInflation?.toFixed(2) ?? "—"}×.
          </p>
        ) : (
          <Inflazione picks={allPicks} reference={state.leagueInflation} />
        )}
      </section>

      <section className={shared.block}>
        <div className={shared.blockHead}>
          <span className="eyebrow">Chi può ancora rilanciare</span>
        </div>
        {showTables ? (
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Partecipante</th>
                <th className={shared.numeric}>Crediti</th>
                <th className={shared.numeric}>Slot</th>
                <th className={shared.numeric}>Max bid</th>
              </tr>
            </thead>
            <tbody>
              {[...state.managers]
                .sort((a, b) => b.creditsLeft - a.creditsLeft)
                .map((m) => (
                  <tr key={m.manager.id}>
                    <td className={m.manager.isMe ? shared.strong : undefined}>
                      {m.manager.name}
                    </td>
                    <td className={shared.numeric}>{m.creditsLeft}</td>
                    <td className={shared.numeric}>{m.slotsLeft}</td>
                    <td className={shared.numeric}>{m.maxBid}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <CreditiAvversari managers={state.managers} />
        )}
      </section>
    </div>
  );
}

function DeviationTable({ picks }: { picks: PickDetail[] }) {
  const sorted = [...picks].sort((a, b) => b.price - b.quotation - (a.price - a.quotation));
  // Gli stessi estremi che mostra il grafico, così le due viste concordano.
  const rows = sorted.length <= 14 ? sorted : [...sorted.slice(0, 7), ...sorted.slice(-7)];
  return (
    <table className={shared.table}>
      <thead>
        <tr>
          <th>Giocatore</th>
          <th>A</th>
          <th className={shared.numeric}>Quotazione</th>
          <th className={shared.numeric}>Pagato</th>
          <th className={shared.numeric}>Scarto</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((pick) => {
          const delta = pick.price - pick.quotation;
          return (
            <tr key={pick.id}>
              <td className={shared.strong}>{pick.playerName}</td>
              <td className={shared.muted}>{pick.managerName}</td>
              <td className={shared.numeric}>{pick.quotation}</td>
              <td className={shared.numeric}>{pick.price}</td>
              <td className={`${shared.numeric} ${delta > 0 ? shared.negative : ""}`}>
                {delta > 0 ? `+${delta}` : delta}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
