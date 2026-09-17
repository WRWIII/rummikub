const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function SoundOnIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      <path d="M16 9.2a4 4 0 0 1 0 5.6" />
      <path d="M18.8 6.6a7.8 7.8 0 0 1 0 10.8" />
    </svg>
  );
}

export function SoundOffIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      <path d="m16.5 9.5 5 5" />
      <path d="m21.5 9.5-5 5" />
    </svg>
  );
}

export function ScoreIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M3.5 9h17" />
      <path d="M9 9v11.5" />
    </svg>
  );
}

/** Sliders rather than a gear — a gear's teeth turn into a sun at 24px. */
export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="8" cy="17" r="2.2" />
    </svg>
  );
}

export function TimerIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4H15" />
      <path d="M9.5 2.5h5" />
    </svg>
  );
}

export function BackIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M15 5.5 8.5 12l6.5 6.5" />
    </svg>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

export function UndoIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M8 8H4.5V4.5" />
      <path d="M4.9 8.2A7.5 7.5 0 1 1 5.5 15" />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.8h5v1.7" />
      <path d="M6.5 6.5 7.4 20h9.2l.9-13.5" />
    </svg>
  );
}
