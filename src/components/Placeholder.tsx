import styles from "./Placeholder.module.css";

/**
 * Segnaposto per una sezione non ancora costruita: elenca cosa ci finirà,
 * così la shell resta navigabile mentre le milestone avanzano.
 *
 * `bare` toglie l'etichetta quando chi lo usa ne ha già messa una sua.
 */
export function Placeholder({ items, bare = false }: { items: string[]; bare?: boolean }) {
  return (
    <section className={bare ? undefined : styles.placeholder}>
      {!bare && <span className="eyebrow">In arrivo</span>}
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
