/** User-visible copy plus optional technical detail for developers. */
export interface UserFacingError {
  title: string;
  message: string;
  /** Raw API / exception text — shown under “Technical details”, not in the main copy. */
  details?: string;
}

function rawErrorText(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function looksLikeNetworkFailure(text: string, err: unknown): boolean {
  if (err instanceof TypeError) return true;
  return /failed to fetch|networkerror|load failed|net::|econnrefused|enotfound|timeout|aborterror/i.test(
    text,
  );
}

/**
 * Keep the main dialog human; put API / stack-ish strings in `details`.
 * Pass a friendly `fallback` for the situation (what the user was trying to do).
 */
export function toUserFacingError(err: unknown, fallback: UserFacingError): UserFacingError {
  const raw = rawErrorText(err);
  if (!raw || raw === '{}' || raw === 'undefined' || raw === 'null') {
    return { ...fallback };
  }

  if (looksLikeNetworkFailure(raw, err)) {
    return {
      title: fallback.title,
      message:
        fallback.message ||
        'We could not reach the server. Check your connection and try again.',
      details: raw,
    };
  }

  // HTTP envelope messages from the API are useful for developers; keep the
  // user-facing sentence from the fallback unless the fallback has no message.
  return {
    title: fallback.title,
    message: fallback.message,
    details: raw,
  };
}

/** Convenience: open-ready payload for dialogAlert. */
export function alertFromError(
  err: unknown,
  fallback: UserFacingError,
): { message: string; title: string; details?: string } {
  const face = toUserFacingError(err, fallback);
  return { message: face.message, title: face.title, details: face.details };
}
