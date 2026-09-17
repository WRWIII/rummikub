"use client";

import type { ReactNode } from "react";

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-tile-face/45">
        {title}
      </h2>
      {description && (
        <p className="mb-3 text-sm text-tile-face/55">{description}</p>
      )}
      <div className="overflow-hidden rounded-2xl bg-white/7">{children}</div>
    </section>
  );
}

export function Row({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/7 px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-base font-medium text-tile-face">
          {label}
        </div>
        {hint && (
          <div className="mt-0.5 text-sm leading-snug text-tile-face/50">
            {hint}
          </div>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  // Flex + padding rather than absolute positioning. An absolutely positioned
  // knob with no `left` resolves to its static position, and the browser's
  // default `text-align: center` on <button> shifts that to the middle of the
  // track — which is how the knob ended up overhanging the right edge. Here the
  // track's own padding sets both ends, so the knob cannot escape it whatever
  // the dimensions are.
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors duration-150 ${
        checked ? "bg-ink-blue" : "bg-white/20"
      }`}
    >
      <span
        className={`h-6 w-6 rounded-full bg-tile-face shadow-sm shadow-black/40 transition-transform duration-150 ease-out ${
          // Track 3.5rem − 0.5rem padding − 1.5rem knob = 1.5rem of travel.
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function Stepper({
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (next: number) => void;
  label: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex items-center gap-1 rounded-xl bg-black/25 p-1">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="h-10 w-10 rounded-lg text-xl font-bold text-tile-face disabled:opacity-30 active:bg-white/10"
      >
        −
      </button>
      <span className="numerals min-w-16 text-center text-lg font-bold text-tile-face">
        {value}
        {suffix}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        className="h-10 w-10 rounded-lg text-xl font-bold text-tile-face disabled:opacity-30 active:bg-white/10"
      >
        +
      </button>
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      className="slider w-36 shrink-0"
    />
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-1 rounded-xl bg-black/25 p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors ${
              active
                ? "bg-tile-face text-felt"
                : "text-tile-face/65 active:bg-white/10"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Numeric entry. Deliberately not type="number": that gives spinners,
 * accidental scroll-wheel edits, and NaN out of valueAsNumber.
 */
export function NumberInput({
  value,
  onChange,
  label,
  placeholder,
  invalid,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      aria-label={label}
      aria-invalid={invalid}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ""))}
      className={`numerals h-12 rounded-xl border bg-black/25 px-3 text-center text-lg font-bold text-tile-face placeholder:font-normal placeholder:text-tile-face/30 ${
        invalid ? "border-ink-red" : "border-white/10"
      } ${className}`}
    />
  );
}

export function TextInput({
  value,
  onChange,
  label,
  placeholder,
  onSubmit,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder?: string;
  onSubmit?: () => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      autoComplete="off"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && onSubmit) onSubmit();
      }}
      className={`h-12 rounded-xl border border-white/10 bg-black/25 px-3 text-base text-tile-face placeholder:text-tile-face/30 ${className}`}
    />
  );
}
