import styles from "./Placeholder.module.css";

/**
 * Segnaposto per una sezione non ancora costruita: dichiara cosa ci finirà,
 * così la shell resta navigabile mentre le milestone avanzano.
 */
export function Placeholder({
  title,
  body,
  items,
}: {
  title: string;
  body: string;
  items: string[];
}) {
  return (
    <section className={styles.placeholder}>
      <div className={styles.rule} />
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{body}</p>
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
