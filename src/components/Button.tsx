import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "md" | "small";
  block?: boolean;
  /** React 19 passes ref as a prop to function components. */
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  variant = "secondary",
  size = "md",
  block = false,
  className = "",
  ref,
  ...rest
}: ButtonProps) {
  const classes = [
    "btn",
    variant === "primary" ? "primary" : "",
    variant === "danger" ? "danger" : "",
    variant === "ghost" ? "ghost" : "",
    size === "small" ? "small" : "",
    block ? "block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button type="button" ref={ref} className={classes} {...rest} />;
}
