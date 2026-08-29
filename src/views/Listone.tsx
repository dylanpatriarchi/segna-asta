import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, keys, ROLES, ROLE_LABEL, type Player, type Role } from "@/lib/api";
import { useAuctionState } from "@/lib/auction";
import { AssignBar } from "@/components/AssignBar";
import shared from "@/styles/shared.module.css";
import styles from "./Listone.module.css";

export function Listone() {
  const { state, auctionId } = useAuctionState();
  const listId = state?.auction.listId;

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [team, setTeam] = useState("");
  const [hideTaken, setHideTaken] = useState(true);
  const [selected, setSelected] = useState<Player | null>(null);

  const players = useQuery({
    queryKey: keys.players(listId ?? 0),
    queryFn: () => api.players(listId as number),
    enabled: listId !== undefined,
  });

  const teams = useQuery({
    queryKey: keys.teams(listId ?? 0),
    queryFn: () => api.teams(listId as number),
    enabled: listId !== undefined,
  });

  const picks = useQuery({
    queryKey: keys.picks(auctionId ?? 0),
    queryFn: () => api.picks(auctionId as number),
    enabled: auctionId != null,
  });

  /** Chi ha preso chi, per marcare le righe già assegnate. */
  const takenBy = useMemo(() => {
    const map = new Map<number, { manager: string; price: number; isMine: boolean }>();
    for (const pick of picks.data ?? []) {
      map.set(pick.playerId, {
        manager: pick.managerName,
        price: pick.price,
        isMine: pick.isMine,
      });
    }
    return map;
  }, [picks.data]);

  // Il filtro gira in locale: 608 righe stanno in memoria senza problemi e
  // la ricerca risponde a ogni tasto senza passare dal database.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (players.data ?? []).filter((player) => {
      if (needle && !player.name.toLowerCase().includes(needle)) return false;
      if (role && player.role !== role) return false;
      if (team && player.serieATeam !== team) return false;
      if (hideTaken && takenBy.has(player.id)) return false;
      return true;
    });
  }, [players.data, search, role, team, hideTaken, takenBy]);

  if (!state) return <NoAuction />;

  return (
    <div className={styles.page}>
      <div className={styles.filters}>
        <input
          className={`${shared.input} ${styles.search}`}
          placeholder="Cerca un giocatore…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className={styles.roleTabs}>
          <RoleTab active={role === ""} onClick={() => setRole("")}>
            Tutti
          </RoleTab>
          {ROLES.map((r) => (
            <RoleTab key={r} active={role === r} onClick={() => setRole(r)}>
              {r}
            </RoleTab>
          ))}
        </div>
        <select
          className={shared.select}
          value={team}
          onChange={(e) => setTeam(e.target.value)}
        >
          <option value="">Tutte le squadre</option>
          {(teams.data ?? []).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={hideTaken}
            onChange={(e) => setHideTaken(e.target.checked)}
          />
          <span>Nascondi i presi</span>
        </label>
        <span className={styles.count}>
          {visible.length} <span className={shared.muted}>di {players.data?.length ?? 0}</span>
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={shared.table}>
          <thead>
            <tr>
              <th>Giocatore</th>
              <th>Squadra</th>
              <th>Ruolo</th>
              <th className={shared.numeric}>Quotazione</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((player) => {
              const taken = takenBy.get(player.id);
              return (
                <tr
                  key={player.id}
                  className={selected?.id === player.id ? styles.selected : undefined}
                  onClick={() => setSelected(taken ? null : player)}
                >
                  <td className={shared.strong}>{player.name}</td>
                  <td className={shared.muted}>{player.serieATeam}</td>
                  <td>
                    <span className={styles.role} title={ROLE_LABEL[player.role]}>
                      {player.role}
                    </span>
                  </td>
                  <td className={shared.numeric}>{player.quotation}</td>
                  <td className={shared.muted}>
                    {taken
                      ? `${taken.isMine ? "Mio" : taken.manager} · ${taken.price}`
                      : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className={shared.empty}>Nessun giocatore con questi filtri.</p>
        )}
      </div>

      {selected && (
        <AssignBar
          player={selected}
          state={state}
          onDone={() => setSelected(null)}
          onCancel={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function RoleTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.roleTab}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function NoAuction() {
  return (
    <div className={shared.page}>
      <p className={shared.empty}>
        Non c'è nessuna asta attiva. Vai in <strong>Impostazioni</strong>,
        importa il listone e crea un'asta.
      </p>
    </div>
  );
}
