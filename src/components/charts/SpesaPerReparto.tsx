import { ROLES, ROLE_LABEL, type BudgetPlanEntry, type PickDetail, type Role } from "@/lib/api";
import { useTooltip } from "./useTooltip";
import styles from "./chart.module.css";

const WIDTH = 900;
const ROW_H = 32;
const BAR_H = 16;
const LABEL_W = 120;
const VALUE_W = 56;

/**
 * Quanto ho speso per reparto contro quanto avevo pianificato. La barra è
 * la spesa, la tacca verticale il piano: si vede in un colpo chi è sopra e
 * chi è sotto senza dover confrontare due barre affiancate.
 */
export function SpesaPerReparto({
  picks,
  plan,
  budget,
}: {
  picks: PickDetail[];
  plan: BudgetPlanEntry[];
  budget: number;
}) {
  const tooltip = useTooltip();

  const rows = ROLES.map((role) => {
    const spent = picks
      .filter((p) => p.role === role)
      .reduce((sum, p) => sum + p.price, 0);
    const pct = plan.find((e) => e.role === role)?.targetPct ?? 0;
    return { role, spent, planned: Math.round((budget * pct) / 100) };
  });

  const scaleMax = Math.max(...rows.map((r) => Math.max(r.spent, r.planned)), 1);
  const plotW = WIDTH - LABEL_W - VALUE_W;
  const height = rows.length * ROW_H + 8;
  const x = (value: number) => (value / scaleMax) * plotW;

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label="Spesa per reparto contro il piano"
      >
        {rows.map((row, index) => {
          const y = index * ROW_H + 8;
          const over = row.spent > row.planned;
          return (
            <g key={row.role}>
              <text className={styles.labelText} x={0} y={y + BAR_H - 2}>
                {ROLE_LABEL[row.role]}
              </text>

              <rect
                className={styles.bar}
                x={LABEL_W}
                y={y}
                width={Math.max(x(row.spent), row.spent > 0 ? 2 : 0)}
                height={BAR_H}
                rx={2}
              />

              {/* La tacca del piano: un riferimento, non un dato da sommare.
                  Solida perché su venti pixel il tratteggio si sbriciola. */}
              <line
                className={styles.tick}
                x1={LABEL_W + x(row.planned)}
                x2={LABEL_W + x(row.planned)}
                y1={y - 5}
                y2={y + BAR_H + 5}
              />

              <text
                className={styles.valueText}
                x={WIDTH}
                y={y + BAR_H - 2}
                textAnchor="end"
                fill={over ? "var(--loss)" : undefined}
              >
                {row.spent}
              </text>

              <rect
                className={styles.hitArea}
                x={LABEL_W}
                y={y - 6}
                width={plotW}
                height={ROW_H - 6}
                onMouseEnter={() =>
                  tooltip.show(
                    ((LABEL_W + x(row.spent)) / WIDTH) * 100,
                    (y / height) * 100,
                    <>
                      {ROLE_LABEL[row.role]}: {row.spent} crediti spesi
                      <br />
                      piano {row.planned} · {over ? "sopra" : "sotto"} di{" "}
                      {Math.abs(row.spent - row.planned)}
                    </>,
                  )
                }
                onMouseLeave={tooltip.hide}
              />
            </g>
          );
        })}
        <line className={styles.axis} x1={LABEL_W} x2={LABEL_W} y1={0} y2={height} />
      </svg>
      {tooltip.node}
      <figcaption className={styles.caption}>
        Barra piena: quanto ho speso. Tacca verticale: quanto avevo
        pianificato per quel reparto.
      </figcaption>
    </figure>
  );
}

export function spesaPerRepartoRows(
  picks: PickDetail[],
  plan: BudgetPlanEntry[],
  budget: number,
): { role: Role; spent: number; planned: number }[] {
  return ROLES.map((role) => ({
    role,
    spent: picks.filter((p) => p.role === role).reduce((sum, p) => sum + p.price, 0),
    planned: Math.round((budget * (plan.find((e) => e.role === role)?.targetPct ?? 0)) / 100),
  }));
}
