import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { api, ROLE_LABEL, type ImportReport } from "@/lib/api";
import { Button } from "@/components/Button";
import { Placeholder } from "@/components/Placeholder";
import styles from "./Impostazioni.module.css";

export function Impostazioni() {
  const queryClient = useQueryClient();

  const lists = useQuery({ queryKey: ["playerLists"], queryFn: api.playerLists });

  const importList = useMutation({
    mutationFn: async () => {
      const path = await open({
        multiple: false,
        filters: [{ name: "Listone FantaMaster", extensions: ["xlsx"] }],
      });
      // `null` significa che il file picker è stato chiuso senza scegliere.
      return path === null ? null : api.importPlayerList(path);
    },
    onSuccess: (report) => {
      if (report) void queryClient.invalidateQueries({ queryKey: ["playerLists"] });
    },
  });

  return (
    <div className={styles.page}>
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <span className="eyebrow">Listone</span>
        </div>
        <p className={styles.blockBody}>
          Importa le quotazioni degli svincolati da un file XLSX di FantaMaster.
          Ogni import crea una lista a sé: aggiornare le quotazioni non tocca
          le aste già giocate.
        </p>
        <div className={styles.actions}>
          <Button onClick={() => importList.mutate()} disabled={importList.isPending}>
            {importList.isPending ? "Importo…" : "Importa da XLSX…"}
          </Button>
          {importList.isError && (
            <span className={styles.error}>{String(importList.error)}</span>
          )}
        </div>

        {importList.data && <ImportSummary report={importList.data} />}

        {lists.data && lists.data.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Lista</th>
                <th>File</th>
                <th>Importata</th>
                <th className={styles.numeric}>Giocatori</th>
              </tr>
            </thead>
            <tbody>
              {lists.data.map((list) => (
                <tr key={list.id}>
                  <td>{list.label}</td>
                  <td className={styles.muted}>{list.sourceFile}</td>
                  <td className={styles.muted}>{formatDate(list.importedAt)}</td>
                  <td className={styles.numeric}>{list.playerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <span className="eyebrow">In arrivo</span>
        </div>
        <Placeholder
          items={[
            "Crediti, struttura rosa e partecipanti della lega",
            "Export CSV/JSON della rosa e backup del database",
            "Aste archiviate: asta vera, simulazioni, stagioni passate",
          ]}
          bare
        />
      </section>
    </div>
  );
}

function ImportSummary({ report }: { report: ImportReport }) {
  return (
    <div className={styles.figures}>
      <Figure value={report.list.playerCount} label="Giocatori" />
      {report.byRole.map(({ role, count }) => (
        <Figure key={role} value={count} label={ROLE_LABEL[role]} />
      ))}
      <Figure value={report.teamCount} label="Squadre" />
      <Figure value={report.totalQuotation} label="Somma quotazioni" />
    </div>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.figure}>
      <div className={styles.figureValue}>{value}</div>
      <div className={styles.figureLabel}>{label}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}
