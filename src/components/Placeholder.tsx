import styles from "./Placeholder.module.css";

/**
 * Segnaposto per una sezione non ancora costruita: elenca cosa ci finirà,
 * così la shell resta navigabile mentre le milestone avanzano.
 */
export function Placeholder({ items }: { items: string[] }) {
  return (
    <section className={styles.placeholder}>
      <span className="eyebrow">In arrivo</span>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item}>
            <span className={styles.bullet}>—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
