import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { api, keys, ROLE_LABEL, type ImportReport } from "@/lib/api";
import { useActiveAuctionId } from "@/lib/auction";
import { Button } from "@/components/Button";
import { Figure } from "@/components/Figure";
import shared from "@/styles/shared.module.css";
import styles from "./Impostazioni.module.css";

export function Impostazioni() {
  const queryClient = useQueryClient();
  const lists = useQuery({ queryKey: keys.playerLists, queryFn: api.playerLists });
  const auctions = useQuery({ queryKey: keys.auctions, queryFn: api.auctions });
  const active = useActiveAuctionId();

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
      if (report) void queryClient.invalidateQueries({ queryKey: keys.playerLists });
    },
  });

  const activate = useMutation({
    mutationFn: api.setActiveAuction,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.activeAuctionId }),
  });

  return (
    <div className={shared.page}>
      <section className={shared.block}>
        <div className={shared.blockHead}>
          <span className="eyebrow">Listone</span>
        </div>
        <p className={shared.blockBody}>
          Importa le quotazioni degli svincolati da un file XLSX di FantaMaster.
          Ogni import crea una lista a sé: aggiornare le quotazioni non tocca
          le aste già giocate.
        </p>
        <div className={shared.row}>
          <Button onClick={() => importList.mutate()} disabled={importList.isPending}>
            {importList.isPending ? "Importo…" : "Importa da XLSX…"}
          </Button>
          {importList.isError && (
            <span className={shared.error}>{String(importList.error)}</span>
          )}
        </div>

        {importList.data && <ImportSummary report={importList.data} />}

        {lists.data && lists.data.length > 0 && (
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Lista</th>
                <th>File</th>
                <th>Importata</th>
                <th className={shared.numeric}>Giocatori</th>
              </tr>
            </thead>
            <tbody>
              {lists.data.map((list) => (
                <tr key={list.id}>
                  <td>{list.label}</td>
                  <td className={shared.muted}>{list.sourceFile}</td>
                  <td className={shared.muted}>{formatDate(list.importedAt)}</td>
                  <td className={shared.numeric}>{list.playerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={shared.block}>
        <div className={shared.blockHead}>
          <span className="eyebrow">Aste</span>
        </div>
        {lists.data && lists.data.length > 0 ? (
          <NewAuctionForm listId={lists.data[0]!.id} />
        ) : (
          <p className={shared.empty}>
            Importa prima un listone: un'asta ha bisogno di sapere su quali
            giocatori si gioca.
          </p>
        )}

        {auctions.data && auctions.data.length > 0 && (
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Asta</th>
                <th className={shared.numeric}>Crediti</th>
                <th className={shared.numeric}>Rosa</th>
                <th>Creata</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {auctions.data.map((auction) => {
                const isActive = auction.id === active.data;
                const slots = auction.slots;
                return (
                  <tr key={auction.id}>
                    <td className={isActive ? shared.strong : undefined}>
                      {auction.name}
                      {auction.isSimulation && (
                        <span className={styles.tag}>prova</span>
                      )}
                    </td>
                    <td className={shared.numeric}>{auction.budget}</td>
                    <td className={shared.numeric}>
                      {slots.p}-{slots.d}-{slots.c}-{slots.a}
                    </td>
                    <td className={shared.muted}>{formatDate(auction.createdAt)}</td>
                    <td className={shared.numeric}>
                      {isActive ? (
                        <span className={shared.muted}>attiva</span>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => activate.mutate(auction.id)}
                        >
                          Attiva
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/** I partecipanti si inseriscono uno per riga: si scrivono più in fretta
 *  che con un campo e un pulsante "aggiungi". */
function NewAuctionForm({ listId }: { listId: number }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("Asta 2026");
  const [budget, setBudget] = useState(500);
  const [slots, setSlots] = useState({ p: 3, d: 8, c: 8, a: 6 });
  const [managers, setManagers] = useState("Io\nMarco\nLuca\nGiulia\nDavide\nFede\nSimo\nAle");
  const [isSimulation, setIsSimulation] = useState(false);

  const names = managers
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);

  const create = useMutation({
    mutationFn: () =>
      api.createAuction({
        name,
        listId,
        budget,
        slots,
        isSimulation,
        managers: names,
        // Il primo nome della lista sono io: è l'ordine in cui si scrive.
        myIndex: 0,
      }),
    onSuccess: async (auction) => {
      await api.setActiveAuction(auction.id);
      void queryClient.invalidateQueries({ queryKey: keys.auctions });
      void queryClient.invalidateQueries({ queryKey: keys.activeAuctionId });
    },
  });

  const total = slots.p + slots.d + slots.c + slots.a;

  return (
    <div className={styles.form}>
      <div className={shared.row}>
        <label className={shared.field}>
          <span className={shared.label}>Nome</span>
          <input
            className={shared.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className={shared.field}>
          <span className={shared.label}>Crediti</span>
          <input
            className={`${shared.input} ${styles.small}`}
            type="number"
            min={1}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
        </label>
        {(["p", "d", "c", "a"] as const).map((role) => (
          <label key={role} className={shared.field}>
            <span className={shared.label}>{role.toUpperCase()}</span>
            <input
              className={`${shared.input} ${styles.tiny}`}
              type="number"
              min={0}
              value={slots[role]}
              onChange={(e) => setSlots({ ...slots, [role]: Number(e.target.value) })}
            />
          </label>
        ))}
        <span className={`${shared.muted} ${styles.totalHint}`}>rosa da {total}</span>
      </div>

      <label className={shared.field}>
        <span className={shared.label}>Partecipanti — il primo sei tu</span>
        <textarea
          className={`${shared.input} ${styles.textarea}`}
          rows={5}
          value={managers}
          onChange={(e) => setManagers(e.target.value)}
        />
      </label>

      <div className={shared.row}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={isSimulation}
            onChange={(e) => setIsSimulation(e.target.checked)}
          />
          <span>Asta di prova</span>
        </label>
        <Button onClick={() => create.mutate()} disabled={create.isPending || names.length < 2}>
          {create.isPending ? "Creo…" : "Crea e attiva"}
        </Button>
        {create.isError && <span className={shared.error}>{String(create.error)}</span>}
      </div>
    </div>
  );
}

function ImportSummary({ report }: { report: ImportReport }) {
  return (
    <div className={shared.figures}>
      <Figure value={report.list.playerCount} label="Giocatori" />
      {report.byRole.map(({ role, count }) => (
        <Figure key={role} value={count} label={ROLE_LABEL[role]} />
      ))}
      <Figure value={report.teamCount} label="Squadre" />
      <Figure value={report.totalQuotation} label="Somma quotazioni" />
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}
