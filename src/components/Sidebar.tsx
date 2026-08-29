import { SECTIONS, sectionNumber } from "@/app/navigation";
import { useUi } from "@/app/store";
import styles from "./Sidebar.module.css";

export function Sidebar() {
  const section = useUi((s) => s.section);
  const goTo = useUi((s) => s.goTo);

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
    </aside>
  );
}
