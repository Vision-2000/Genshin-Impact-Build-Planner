"use client";

// Replaces window.confirm/window.alert with a themed, in-app dialog. A plain
// conditionally-rendered overlay rather than the native <dialog> element +
// showModal() -- that imperative open call turned out to be unreliable, and
// plain JSX has no such failure mode: it renders whenever `state` is set,
// full stop.
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Styles the confirm button as a destructive action (red instead of black).
  danger?: boolean;
};

type AlertOptions = {
  title?: string;
  okLabel?: string;
};

type DialogState =
  | { kind: "confirm"; message: string; options: ConfirmOptions; resolve: (confirmed: boolean) => void }
  | { kind: "alert"; message: string; options: AlertOptions; resolve: () => void };

type DialogContextValue = {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  notify: (message: string, options?: AlertOptions) => Promise<void>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ kind: "confirm", message, options, resolve });
    });
  }, []);

  const notify = useCallback((message: string, options: AlertOptions = {}) => {
    return new Promise<void>((resolve) => {
      setState({ kind: "alert", message, options, resolve });
    });
  }, []);

  function close(confirmed: boolean) {
    if (!state) return;
    if (state.kind === "confirm") state.resolve(confirmed);
    else state.resolve();
    setState(null);
  }

  // Esc dismisses like a native dialog would (treated as a decline). Reads
  // `state` directly (rather than calling close()) so it's the effect's only
  // dependency.
  useEffect(() => {
    if (!state) return;
    const dialogState = state;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (dialogState.kind === "confirm") dialogState.resolve(false);
      else dialogState.resolve();
      setState(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state]);

  return (
    <DialogContext.Provider value={{ confirm, notify }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) close(false);
          }}
        >
          <div
            role={state.kind === "confirm" ? "alertdialog" : "dialog"}
            aria-modal="true"
            className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-5 text-foreground shadow-lg"
          >
            {state.options.title && <h2 className="text-base font-semibold">{state.options.title}</h2>}
            <p className="whitespace-pre-line text-sm text-foreground">{state.message}</p>
            <div className="flex justify-end gap-2">
              {state.kind === "confirm" && (
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="rounded px-3 py-1.5 text-sm hover:bg-black/5"
                >
                  {state.options.cancelLabel ?? "Cancel"}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={`rounded px-3 py-1.5 text-sm text-white ${
                  state.kind === "confirm" && state.options.danger ? "bg-red-600" : "bg-black"
                }`}
              >
                {state.kind === "confirm" ? (state.options.confirmLabel ?? "Confirm") : (state.options.okLabel ?? "OK")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialogs() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("useDialogs must be used within a DialogProvider");
  return context;
}
