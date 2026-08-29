import { useState, type ReactNode } from "react";
import styles from "./chart.module.css";

/** Posizione in percentuale del riquadro del grafico: l'SVG scala col
 *  viewBox, quindi le coordinate in pixel non reggerebbero il ridimensionamento. */
type TooltipState = { xPct: number; yPct: number; content: ReactNode } | null;

export function useTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const show = (xPct: number, yPct: number, content: ReactNode) =>
    setTooltip({ xPct, yPct, content });
  const hide = () => setTooltip(null);

  const node = tooltip ? (
    <div
      className={styles.tooltip}
      style={{ left: `${tooltip.xPct}%`, top: `calc(${tooltip.yPct}% - 6px)` }}
    >
      {tooltip.content}
    </div>
  ) : null;

  return { show, hide, node };
}
