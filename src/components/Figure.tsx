import shared from "@/styles/shared.module.css";

/** Un numero grande con la sua etichetta sotto: il mattone dei riepiloghi. */
export function Figure({
  value,
  label,
  alert = false,
}: {
  value: string | number;
  label: string;
  alert?: boolean;
}) {
  return (
    <div className={shared.figure}>
      <div className={`${shared.figureValue} ${alert ? shared.negative : ""}`}>{value}</div>
      <div className={shared.figureLabel}>{label}</div>
    </div>
  );
}
