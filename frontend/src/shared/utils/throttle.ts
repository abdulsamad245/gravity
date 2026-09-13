/**
 * Leading+trailing throttle: fires immediately, then at most once per
 * `ms`, always delivering the latest arguments. Used for cursor
 * broadcasting and drag commits.
 */
export function throttle<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const invoke = (args: Parameters<T>) => {
    last = Date.now();
    fn(...args);
  };

  return ((...args: Parameters<T>) => {
    lastArgs = args;
    const elapsed = Date.now() - last;
    if (elapsed >= ms) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      invoke(args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        if (lastArgs) invoke(lastArgs);
      }, ms - elapsed);
    }
  }) as T;
}
