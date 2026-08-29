import { sectionById, sectionNumber, type SectionId } from "@/app/navigation";
import styles from "./PageHeader.module.css";

export function PageHeader({ section }: { section: SectionId }) {
  const { label, caption } = sectionById(section);

  return (
    <header className={styles.header}>
      <div className={styles.number}>{sectionNumber(section)}</div>
      <div>
        <h1 className={styles.title}>{label}</h1>
        <p className={styles.caption}>{caption}</p>
      </div>
    </header>
  );
}
