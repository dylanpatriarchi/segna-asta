import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, keys, ROLES, ROLE_LABEL, type PickDetail } from "@/lib/api";
import { useAuctionState } from "@/lib/auction";
import { NoAuction } from "./Listone";
import shared from "@/styles/shared.module.css";
import styles from "./Rose.module.css";

export function Rose() {
  const { state, auctionId } = useAuctionState();

  const picks = useQuery({
    queryKey: keys.picks(auctionId ?? 0),
    queryFn: () => api.picks(auctionId as number),
    enabled: auctionId != null,
  });

  const byManager = useMemo(() => {
    const map = new Map<number, PickDetail[]>();
    for (const pick of picks.data ?? []) {
      const list = map.get(pick.managerId) ?? [];
      list.push(pick);
      map.set(pick.managerId, list);
    }
    return map;
  }, [picks.data]);

  if (!state) return <NoAuction />;

  return (
    <div className={styles.page}>
      {state.managers.map((m) => {
        const roster = byManager.get(m.manager.id) ?? [];
        return (
          <section
            key={m.manager.id}
            className={m.manager.isMe ? styles.mine : styles.roster}
          >
            <header className={styles.head}>
              <h2 className={styles.name}>
                {m.manager.name}
                {m.manager.isMe && <span className={styles.tag}>io</span>}
              </h2>
              <div className={styles.totals}>
                <span className={m.creditsLeft < 0 ? shared.negative : undefined}>
                  {m.creditsLeft} cr
                </span>
                <span className={shared.muted}>{roster.length}/{state.auction.slots.p + state.auction.slots.d + state.auction.slots.c + state.auction.slots.a}</span>
              </div>
            </header>

            {ROLES.map((role) => {
              const inRole = roster.filter((p) => p.role === role);
              const target = state.auction.slots[
                role.toLowerCase() as "p" | "d" | "c" | "a"
              ];
              return (
                <div key={role} className={styles.dept}>
                  <div className={styles.deptHead}>
                    <span className={shared.label}>{ROLE_LABEL[role]}</span>
                    <span className={shared.muted}>
                      {inRole.length}/{target}
                    </span>
                  </div>
                  <ul className={styles.list}>
                    {inRole.map((pick) => (
                      <li key={pick.id} className={styles.item}>
                        <span>{pick.playerName}</span>
                        <span className={shared.muted}>{pick.serieATeam}</span>
                        <span className={shared.numeric}>{pick.price}</span>
                      </li>
                    ))}
                    {/* Le caselle vuote si vedono: una rosa incompleta deve
                        sembrare incompleta */}
                    {Array.from({ length: Math.max(0, target - inRole.length) }).map(
                      (_, index) => (
                        <li key={`empty-${index}`} className={styles.emptySlot}>
                          —
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
