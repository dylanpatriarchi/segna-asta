import type { ManagerState } from "@/lib/api";
import { useTooltip } from "./useTooltip";
import styles from "./chart.module.css";

const WIDTH = 900;
const ROW_H = 30;
const BAR_H = 16;
const NAME_W = 110;
const VALUE_W = 96;

/**
 * Quanti crediti restano a ciascuno e quanti slot deve ancora riempire.
 * La mia barra è nera, le altre grigie: l'unica identità che conta qui è
 * "io contro tutti gli altri".
 */
export function CreditiAvversari({ managers }: { managers: ManagerState[] }) {
  const tooltip = useTooltip();

  const rows = [...managers].sort((a, b) => b.creditsLeft - a.creditsLeft);
  const maxCredits = Math.max(...rows.map((r) => r.creditsLeft), 1);
  const plotW = WIDTH - NAME_W - VALUE_W;
  const height = rows.length * ROW_H + 8;

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label="Crediti residui per partecipante"
      >
        {rows.map((row, index) => {
          const y = index * ROW_H + 8;
          const width = Math.max((Math.max(row.creditsLeft, 0) / maxCredits) * plotW, 2);
          return (
            <g key={row.manager.id}>
              <text
                className={row.manager.isMe ? styles.valueText : styles.labelText}
                x={0}
                y={y + BAR_H - 2}
              >
                {row.manager.isMe ? "Io" : row.manager.name}
              </text>

              <rect
                className={row.manager.isMe ? styles.bar : styles.barMuted}
                x={NAME_W}
                y={y}
                width={width}
                height={BAR_H}
                rx={2}
              />

              <text
                className={styles.labelText}
                x={WIDTH}
                y={y + BAR_H - 2}
                textAnchor="end"
              >
                <tspan className={styles.valueText}>{row.creditsLeft}</tspan>
                <tspan> · {row.slotsLeft} slot</tspan>
              </text>

              <rect
                className={styles.hitArea}
                x={NAME_W}
                y={y - 4}
                width={plotW}
                height={ROW_H - 4}
                onMouseEnter={() =>
                  tooltip.show(
                    ((NAME_W + width) / WIDTH) * 100,
                    (y / height) * 100,
                    <>
                      {row.manager.name}: {row.creditsLeft} crediti, {row.slotsLeft} slot
                      <br />
                      può offrire fino a {row.maxBid} su un solo giocatore
                    </>,
                  )
                }
                onMouseLeave={tooltip.hide}
              />
            </g>
          );
        })}
        <line className={styles.axis} x1={NAME_W} x2={NAME_W} y1={0} y2={height} />
      </svg>
      {tooltip.node}
      <figcaption className={styles.caption}>
        Chi ha ancora crediti e quante caselle deve riempire: sono gli
        avversari che possono davvero rilanciare su un obiettivo.
      </figcaption>
    </figure>
  );
}
