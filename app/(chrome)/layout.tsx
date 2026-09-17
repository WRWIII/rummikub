import { ScreenHeader } from "@/components/nav/screen-header";
import { RunningTimerChip } from "@/components/nav/running-timer-chip";

/**
 * Route group — adds no URL segment, so these stay at /score and /settings.
 * Only the secondary screens get chrome; the timer itself has none, because a
 * permanent tab bar is a strip of accidental navigation sitting exactly where
 * a passed-around phone gets grabbed.
 */
export default function ChromeLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="felt flex min-h-[100dvh] flex-col">
      <ScreenHeader />
      <main
        className="flex-1 px-4 pb-32 pt-4"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
        }}
      >
        {children}
      </main>
      <RunningTimerChip />
    </div>
  );
}
