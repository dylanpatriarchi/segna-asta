import { SECTIONS, sectionNumber } from "@/app/navigation";
import { useUi } from "@/app/store";
import { useAuctionState, myState } from "@/lib/auction";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  const section = useUi((s) => s.section);
  const goTo = useUi((s) => s.goTo);
  const { state } = useAuctionState();
  const me = myState(state);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.wordmark}>Segna-Asta</div>
      </div>

      <nav className={styles.nav} aria-label="Sezioni">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={styles.item}
            aria-current={s.id === section}
            onClick={() => goTo(s.id)}
          >
            <span className={styles.itemNumber}>{sectionNumber(s.id)}</span>
            <span className={styles.itemLabel}>{s.label}</span>
          </button>
        ))}
      </nav>

      {/* Crediti e max bid restano sott'occhio da qualsiasi sezione */}
      {state && me && (
        <div className={styles.footer}>
          <span className="eyebrow">{state.auction.name}</span>
          <div className={styles.figures}>
            <div>
              <div className={styles.value}>{me.creditsLeft}</div>
              <div className={styles.hint}>crediti</div>
            </div>
            <div>
              <div className={styles.value}>{me.maxBid}</div>
              <div className={styles.hint}>max bid</div>
            </div>
            <div>
              <div className={styles.value}>{me.slotsLeft}</div>
              <div className={styles.hint}>slot</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
