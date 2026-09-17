"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";

export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    // Move focus in, so a keyboard or screen-reader user isn't left behind on
    // the page underneath.
    panelRef.current?.focus();

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-felt shadow-2xl shadow-black/60 outline-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-bold text-tile-face">{title}</h2>
          <Button variant="ghost" onClick={onClose} className="min-h-10 px-3">
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>
        {footer && (
          <div className="border-t border-white/10 px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Reset and Undo are destructive and the phone is being handed around, so both
 * go through here.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet open={open} title={title} onClose={onCancel}>
      <p className="text-base leading-relaxed text-tile-face/80">
        {body}
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          onClick={onConfirm}
          className="flex-1"
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
