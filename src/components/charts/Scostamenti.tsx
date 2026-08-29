import type { PickDetail } from "@/lib/api";
import { useTooltip } from "./useTooltip";
import styles from "./chart.module.css";

const WIDTH = 900;
const ROW_H = 24;
const NAME_W = 150;
const VALUE_W = 52;
const DOT_R = 4;

/**
 * Da quotazione a prezzo pagato, un giocatore per riga. Si mostrano i due
 * estremi — chi è stato pagato più sopra il listino e chi più sotto —
 * perché una lista di soli sovrapprezzi non direbbe dove sono gli affari.
 *
 * La direzione del segmento dice già tutto: il colore e il segno del numero
 * lo confermano, così l'informazione non è mai solo nel colore.
 */
export function Scostamenti({ picks, limit = 14 }: { picks: PickDetail[]; limit?: number }) {
  const tooltip = useTooltip();

  const sorted = [...picks].sort(
    (a, b) => b.price - b.quotation - (a.price - a.quotation),
  );
  const half = Math.floor(limit / 2);
  const rows =
    sorted.length <= limit
      ? sorted
      : [...sorted.slice(0, half), ...sorted.slice(-half)];

  if (rows.length === 0) {
    return <p className={styles.empty}>Nessuna assegnazione da confrontare.</p>;
  }

  const maxValue = Math.max(...rows.flatMap((r) => [r.price, r.quotation]), 1);
  const plotW = WIDTH - NAME_W - VALUE_W;
  const height = rows.length * ROW_H + 12;
  const x = (value: number) => NAME_W + (value / maxValue) * plotW;

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label="Scostamento fra prezzo pagato e quotazione"
      >
        {rows.map((pick, index) => {
          const y = index * ROW_H + 12;
          const delta = pick.price - pick.quotation;
          const color = delta > 0 ? "var(--loss)" : delta < 0 ? "var(--gain)" : "var(--ink-3)";
          return (
            <g key={pick.id}>
              <text className={styles.labelText} x={0} y={y + 4}>
                {pick.playerName.length > 18
                  ? `${pick.playerName.slice(0, 17)}…`
                  : pick.playerName}
              </text>

              <line
                x1={x(pick.quotation)}
                x2={x(pick.price)}
                y1={y}
                y2={y}
                stroke={color}
                strokeWidth={2}
              />
              {/* Quotazione: cerchio vuoto. Prezzo: cerchio pieno. */}
              <circle
                cx={x(pick.quotation)}
                cy={y}
                r={DOT_R - 1}
                fill="var(--paper)"
                stroke="var(--ink-3)"
                strokeWidth={1.5}
              />
              <circle cx={x(pick.price)} cy={y} r={DOT_R} fill={color} />

              <text
                className={styles.valueText}
                x={WIDTH}
                y={y + 4}
                textAnchor="end"
                fill={color}
              >
                {delta > 0 ? `+${delta}` : delta}
              </text>

              <rect
                className={styles.hitArea}
                x={NAME_W}
                y={y - ROW_H / 2}
                width={plotW}
                height={ROW_H}
                onMouseEnter={() =>
                  tooltip.show(
                    (x(pick.price) / WIDTH) * 100,
                    (y / height) * 100,
                    <>
                      {pick.playerName} · {pick.managerName}
                      <br />
                      pagato {pick.price} su quotazione {pick.quotation}
                    </>,
                  )
                }
                onMouseLeave={tooltip.hide}
              />
            </g>
          );
        })}
      </svg>
      {tooltip.node}
      <figcaption className={styles.caption}>
        Cerchio vuoto: quotazione di listino. Cerchio pieno: prezzo pagato.
        Verso destra si è pagato più del listino, verso sinistra si è fatto
        un affare. In elenco i due estremi della lega.
      </figcaption>
    </figure>
  );
}
