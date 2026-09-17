"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BackIcon } from "@/components/ui/icons";

const TABS = [
  { href: "/score", label: "Scores" },
  { href: "/settings", label: "Settings" },
];

export function ScreenHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-felt-deep/92 backdrop-blur">
      <div
        className="flex items-center gap-1 px-2"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <Link
          href="/"
          aria-label="Back to timer"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-tile-face/75 active:bg-white/10"
        >
          <BackIcon className="h-6 w-6" />
        </Link>

        <nav className="flex gap-1">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-base font-semibold transition-colors ${
                  active
                    ? "bg-tile-face text-felt"
                    : "text-tile-face/60 active:bg-white/10"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
