import { sectionById, type SectionId } from "@/app/navigation";
import styles from "./PageHeader.module.css";

export function PageHeader({ section }: { section: SectionId }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{sectionById(section).label}</h1>
    </header>
  );
}
