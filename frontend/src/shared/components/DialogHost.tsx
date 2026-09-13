import { useEffect, useId, useRef, useState } from 'react';
import { create } from 'zustand';
import { usePresence } from '../hooks/useOpenTransition';

type DialogKind = 'alert' | 'confirm' | 'prompt';

interface DialogRequest {
  kind: DialogKind;
  title: string;
  message: string;
  /** Optional technical / API detail for developers (collapsed by default). */
  details?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** For prompts: return an error string to keep the dialog open, or null when valid. */
  validate?: (value: string) => string | null;
  resolve: (value: string | boolean | null) => void;
}

interface DialogState {
  current: DialogRequest | null;
  open: (req: Omit<DialogRequest, 'resolve'>) => Promise<string | boolean | null>;
  close: (value: string | boolean | null) => void;
}

export type DialogAlertOptions = {
  title?: string;
  details?: string;
  confirmLabel?: string;
};

/** In-app dialogs replace window.alert / confirm / prompt. */
export const useDialogStore = create<DialogState>((set, get) => ({
  current: null,
  open: (req) =>
    new Promise((resolve) => {
      set({ current: { ...req, resolve } });
    }),
  close: (value) => {
    const cur = get().current;
    if (!cur) return;
    cur.resolve(value);
    set({ current: null });
  },
}));

/**
 * Show a notice. Prefer short human copy in `message`; put API / exception text in
 * `options.details` so developers can expand “Technical details”.
 */
export async function dialogAlert(
  message: string,
  titleOrOptions: string | DialogAlertOptions = 'Notice',
): Promise<void> {
  const opts =
    typeof titleOrOptions === 'string' ? { title: titleOrOptions } : (titleOrOptions ?? {});
  await useDialogStore.getState().open({
    kind: 'alert',
    title: opts.title ?? 'Notice',
    message,
    details: opts.details?.trim() || undefined,
    confirmLabel: opts.confirmLabel ?? 'OK',
  });
}

export async function dialogConfirm(
  message: string,
  title = 'Confirm',
  confirmLabel = 'Confirm',
): Promise<boolean> {
  const result = await useDialogStore.getState().open({
    kind: 'confirm',
    title,
    message,
    confirmLabel,
    cancelLabel: 'Cancel',
  });
  return result === true;
}

export async function dialogPrompt(
  message: string,
  defaultValue = '',
  title = 'Input',
  options?: {
    confirmLabel?: string;
    cancelLabel?: string;
    validate?: (value: string) => string | null;
  },
): Promise<string | null> {
  const result = await useDialogStore.getState().open({
    kind: 'prompt',
    title,
    message,
    defaultValue,
    confirmLabel: options?.confirmLabel ?? 'OK',
    cancelLabel: options?.cancelLabel ?? 'Cancel',
    validate: options?.validate,
  });
  return typeof result === 'string' ? result : null;
}

export function DialogHost() {
  const current = useDialogStore((s) => s.current);
  const close = useDialogStore((s) => s.close);
  const titleId = useId();
  const descId = useId();
  const errorId = useId();
  const detailsId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef('');
  const [held, setHeld] = useState<DialogRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mounted, className } = usePresence(!!current);

  useEffect(() => {
    if (current) {
      setHeld(current);
      valueRef.current = current.defaultValue ?? '';
      setError(null);
    }
  }, [current]);

  useEffect(() => {
    if (!mounted) setHeld(null);
  }, [mounted]);

  useEffect(() => {
    if (!held || !current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(held.kind === 'confirm' ? false : null);
      }
    };
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      if (held.kind === 'prompt') {
        // Select so a full-URL paste replaces a prefilled `https://` instead of doubling it.
        inputRef.current?.focus();
        inputRef.current?.select();
      } else document.getElementById('dialog-confirm')?.focus();
    });
    return () => window.removeEventListener('keydown', onKey);
  }, [held, current, close]);

  const submitPrompt = () => {
    if (!held || held.kind !== 'prompt') return;
    const value = valueRef.current;
    if (held.validate) {
      const message = held.validate(value);
      if (message) {
        setError(message);
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
    }
    setError(null);
    close(value);
  };

  if (!mounted || !held) return null;

  const details = held.details?.trim();

  return (
    <div
      className={`dialog-backdrop ${className}`}
      role="presentation"
      onMouseDown={() => close(held.kind === 'confirm' ? false : null)}
    >
      <div
        className="dialog panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="dialog-title">
          {held.title}
        </h2>
        <p id={descId} className="dialog-message">
          {held.message}
        </p>
        {details ? (
          <details className="dialog-details">
            <summary>Technical details</summary>
            <pre id={detailsId} className="dialog-details-body">
              {details}
            </pre>
          </details>
        ) : null}
        {held.kind === 'prompt' && (
          <>
            <input
              ref={inputRef}
              className={`input${error ? ' input-invalid' : ''}`}
              defaultValue={held.defaultValue}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(e) => {
                valueRef.current = e.target.value;
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitPrompt();
                }
              }}
            />
            {error && (
              <p id={errorId} className="dialog-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
        <div className="dialog-actions">
          {held.kind !== 'alert' && (
            <button
              type="button"
              className="btn"
              onClick={() => close(held.kind === 'confirm' ? false : null)}
            >
              {held.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button
            id="dialog-confirm"
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (held.kind === 'confirm') close(true);
              else if (held.kind === 'prompt') submitPrompt();
              else close(true);
            }}
          >
            {held.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
