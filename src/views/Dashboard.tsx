import { useQuery } from "@tanstack/react-query";
import { api, keys } from "@/lib/api";
import { useAuctionState, myState } from "@/lib/auction";
import { Figure } from "@/components/Figure";
import { useUi } from "@/app/store";
import { Button } from "@/components/Button";
import shared from "@/styles/shared.module.css";
import styles from "./Dashboard.module.css";

export function Dashboard() {
  const { state, auctionId, isLoading } = useAuctionState();
  const goTo = useUi((s) => s.goTo);

  const picks = useQuery({
    queryKey: keys.picks(auctionId ?? 0),
    queryFn: () => api.picks(auctionId as number),
    enabled: auctionId != null,
  });

  if (isLoading) return <div className={shared.page} />;

  // Prima volta che si apre l'app: si dice cosa fare, invece di mostrare
  // una schermata vuota.
  if (!state) {
    return (
      <div className={shared.page}>
        <section className={shared.block}>
          <div className={shared.blockHead}>
            <span className="eyebrow">Si comincia da qui</span>
          </div>
          <p className={shared.blockBody}>
            Importa il listone degli svincolati e crea la tua asta: da lì in poi
            ogni sezione si popola da sola man mano che segni le assegnazioni.
          </p>
          <div className={shared.row}>
            <Button onClick={() => goTo("impostazioni")}>Vai a Impostazioni</Button>
          </div>
        </section>
      </div>
    );
  }

  const me = myState(state);
  const recent = [...(picks.data ?? [])].reverse().slice(0, 8);
  const totalSlots = state.auction.slots.p + state.auction.slots.d + state.auction.slots.c + state.auction.slots.a;

  return (
    <div className={shared.page}>
      {me && (
        <section className={shared.block}>
          <div className={shared.blockHead}>
            <span className="eyebrow">La mia asta</span>
            <span className={shared.muted}>{state.auction.name}</span>
          </div>
          <div className={shared.figures}>
            <Figure value={me.creditsLeft} label="Crediti residui" alert={me.creditsLeft < 0} />
            <Figure value={me.maxBid} label="Massimo per un giocatore" />
            <Figure value={`${totalSlots - me.slotsLeft}/${totalSlots}`} label="Rosa" />
            <Figure
              value={me.affordableAverage === null ? "—" : me.affordableAverage.toFixed(1)}
              label="Media per slot"
            />
          </div>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Reparto</th>
                <th className={shared.numeric}>Presi</th>
                <th className={shared.numeric}>Mancano</th>
                <th className={shared.numeric}>Spesa</th>
              </tr>
            </thead>
            <tbody>
              {(["p", "d", "c", "a"] as const).map((role) => {
                const spent = (picks.data ?? [])
                  .filter((p) => p.isMine && p.role === role.toUpperCase())
                  .reduce((sum, p) => sum + p.price, 0);
                return (
                  <tr key={role}>
                    <td>{role.toUpperCase()}</td>
                    <td className={shared.numeric}>{me.filled[role]}</td>
                    <td className={shared.numeric}>{me.missing[role]}</td>
                    <td className={shared.numeric}>{spent}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className={shared.block}>
        <div className={shared.blockHead}>
          <span className="eyebrow">La lega</span>
          <span className={shared.muted}>{state.picksCount} assegnazioni</span>
        </div>
        <div className={shared.figures}>
          <Figure
            value={state.inflation === null ? "—" : `${state.inflation.toFixed(2)}×`}
            label="Inflazione corrente"
          />
          <Figure
            value={state.leagueInflation === null ? "—" : `${state.leagueInflation.toFixed(2)}×`}
            label="Riferimento di lega"
          />
          <Figure value={state.totalPaid} label="Crediti spesi" />
        </div>
        <p className={styles.note}>
          Sopra il riferimento di lega il mercato sta correndo: conviene
          aspettare. Sotto, si stanno facendo affari.
        </p>
      </section>

      <section className={shared.block}>
        <div className={shared.blockHead}>
          <span className="eyebrow">Ultimi movimenti</span>
        </div>
        {recent.length === 0 ? (
          <p className={shared.empty}>Non è ancora stato assegnato nessuno.</p>
        ) : (
          <table className={shared.table}>
            <tbody>
              {recent.map((pick) => (
                <tr key={pick.id}>
                  <td className={shared.strong}>{pick.playerName}</td>
                  <td className={shared.muted}>{pick.role}</td>
                  <td className={pick.isMine ? shared.strong : shared.muted}>
                    {pick.isMine ? "Io" : pick.managerName}
                  </td>
                  <td className={shared.numeric}>{pick.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
