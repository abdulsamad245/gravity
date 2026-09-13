import { useEffect, useState } from 'react';

const TYPE_MS = 38;
const HOLD_MS = 2200;
const DELETE_MS = 22;
const PAUSE_MS = 420;

/**
 * Typewriter-style rotating placeholder while the field is empty and idle.
 * Respects prefers-reduced-motion (cycles full strings, no character animation).
 */
export function useTypedPlaceholder(
  examples: readonly string[],
  opts: { active: boolean },
): string {
  const [text, setText] = useState(examples[0] ?? '');

  useEffect(() => {
    if (!opts.active || examples.length === 0) {
      setText(examples[0] ?? '');
      return;
    }

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cancelled = false;
    let exampleIndex = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (fn: () => void, ms: number) => {
      timer = setTimeout(fn, ms);
    };

    if (reduced) {
      setText(examples[0]!);
      const tick = () => {
        if (cancelled) return;
        exampleIndex = (exampleIndex + 1) % examples.length;
        setText(examples[exampleIndex]!);
        schedule(tick, HOLD_MS + PAUSE_MS);
      };
      schedule(tick, HOLD_MS);
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }

    let charIndex = 0;
    let deleting = false;

    const step = () => {
      if (cancelled) return;
      const full = examples[exampleIndex] ?? '';

      if (!deleting) {
        charIndex = Math.min(full.length, charIndex + 1);
        setText(full.slice(0, charIndex));
        if (charIndex >= full.length) {
          schedule(() => {
            deleting = true;
            step();
          }, HOLD_MS);
          return;
        }
        schedule(step, TYPE_MS);
        return;
      }

      charIndex = Math.max(0, charIndex - 1);
      setText(full.slice(0, charIndex));
      if (charIndex <= 0) {
        deleting = false;
        exampleIndex = (exampleIndex + 1) % examples.length;
        schedule(step, PAUSE_MS);
        return;
      }
      schedule(step, DELETE_MS);
    };

    step();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [examples, opts.active]);

  return text;
}
