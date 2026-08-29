import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({ variant = "primary", className, ...props }: Props) {
  const classes = [styles.button, variant === "secondary" ? styles.secondary : "", className]
    .filter(Boolean)
    .join(" ");
  return <button type="button" {...props} className={classes} />;
}
