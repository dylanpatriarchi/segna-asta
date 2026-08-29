import { useTooltip } from "./useTooltip";
import type { PickDetail } from "@/lib/api";
import styles from "./chart.module.css";

const WIDTH = 900;
const HEIGHT = 260;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 24;

/**
 * Il moltiplicatore medio pagato sul listino, ricalcolato a ogni
 * assegnazione. La linea tratteggiata è quanto la lega può permettersi in
 * media: sopra, il mercato sta correndo.
 */
export function Inflazione({
  picks,
  reference,
}: {
  picks: PickDetail[];
  reference: number | null;
}) {
  const tooltip = useTooltip();

  // Media cumulata, non prezzo per prezzo: interessa dove sta andando il
  // mercato, non il singolo colpo di testa.
  let paid = 0;
  let listed = 0;
  const points = [...picks]
    .sort((a, b) => a.seq - b.seq)
    .map((pick, index) => {
      paid += pick.price;
      listed += pick.quotation;
      return { index: index + 1, value: listed > 0 ? paid / listed : 1, pick };
    });

  if (points.length < 2) {
    return (
      <p className={styles.empty}>
        Servono almeno due assegnazioni perché l'andamento dica qualcosa.
      </p>
    );
  }

  // Il dominio segue i valori veri: ancorarlo a 1 schiaccerebbe la linea
  // in fondo al riquadro, sprecando metà del grafico per raccontare nulla.
  const values = points.map((p) => p.value).concat(reference ?? []);
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const margin = Math.max((highest - lowest) * 0.15, 0.02);
  const min = lowest - margin;
  const max = highest + margin;

  const plotW = WIDTH - PAD_L - PAD_R;
  const plotH = HEIGHT - PAD_T - PAD_B;
  const x = (index: number) => PAD_L + ((index - 1) / (points.length - 1)) * plotW;
  const y = (value: number) => PAD_T + plotH - ((value - min) / (max - min)) * plotH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.index)} ${y(p.value)}`).join(" ");
  const ticks = [min, (min + max) / 2, max];
  const last = points[points.length - 1]!;

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Andamento dell'inflazione durante l'asta"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className={styles.grid} x1={PAD_L} x2={WIDTH - PAD_R} y1={y(tick)} y2={y(tick)} />
            <text className={styles.tickText} x={0} y={y(tick) + 3}>
              {tick.toFixed(2)}×
            </text>
          </g>
        ))}

        {reference !== null && (
          <>
            <line
              className={styles.threshold}
              x1={PAD_L}
              x2={WIDTH - PAD_R}
              y1={y(reference)}
              y2={y(reference)}
            />
            <text
              className={styles.tickText}
              x={WIDTH - PAD_R}
              y={y(reference) - 5}
              textAnchor="end"
            >
              riferimento di lega {reference.toFixed(2)}×
            </text>
          </>
        )}

        <path className={styles.line} d={path} />

        {/* Etichetta diretta sull'ultimo punto: l'unico numero che serve
            leggere senza passarci sopra col mouse */}
        <circle cx={x(last.index)} cy={y(last.value)} r={4} fill="var(--ink)" />
        <text
          className={styles.valueText}
          x={x(last.index)}
          y={y(last.value) - 9}
          textAnchor="end"
        >
          {last.value.toFixed(2)}×
        </text>

        <line className={styles.axis} x1={PAD_L} x2={WIDTH - PAD_R} y1={HEIGHT - PAD_B} y2={HEIGHT - PAD_B} />
        <text className={styles.tickText} x={PAD_L} y={HEIGHT - PAD_B + 14}>
          1
        </text>
        <text
          className={styles.tickText}
          x={WIDTH - PAD_R}
          y={HEIGHT - PAD_B + 14}
          textAnchor="end"
        >
          {points.length} assegnazioni
        </text>

        {points.map((point) => (
          <rect
            key={point.index}
            className={styles.hitArea}
            x={x(point.index) - plotW / points.length / 2}
            y={PAD_T}
            width={plotW / points.length}
            height={plotH}
            onMouseEnter={() =>
              tooltip.show(
                (x(point.index) / WIDTH) * 100,
                (y(point.value) / HEIGHT) * 100,
                <>
                  Dopo {point.index}: {point.value.toFixed(2)}×
                  <br />
                  {point.pick.playerName} a {point.pick.price} (quot. {point.pick.quotation})
                </>,
              )
            }
            onMouseLeave={tooltip.hide}
          />
        ))}
      </svg>
      {tooltip.node}
      <figcaption className={styles.caption}>
        Media cumulata di quanto si sta pagando rispetto al listino, aggiornata
        a ogni assegnazione.
      </figcaption>
    </figure>
  );
}
