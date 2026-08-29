import { PageHeader } from "@/components/PageHeader";
import { Sidebar } from "@/components/Sidebar";
import { SectionView } from "@/views";
import { useUi } from "@/app/store";
import styles from "./App.module.css";

export default function App() {
  const section = useUi((s) => s.section);

  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <PageHeader section={section} />
        <div className={styles.content}>
          <SectionView section={section} />
        </div>
      </main>
    </div>
  );
}
