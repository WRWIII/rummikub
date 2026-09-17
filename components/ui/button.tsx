"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-tile-face text-felt active:bg-tile-mid",
  secondary:
    "bg-white/10 text-tile-face active:bg-white/15",
  ghost:
    "text-tile-face/70 active:bg-white/10",
  danger:
    "bg-ink-red text-tile-face active:opacity-90",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    />
  );
}
