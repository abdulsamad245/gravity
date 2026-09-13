import { inject } from 'vitest';

export type ApiSuccess<T> = {
  data: T;
  meta: { requestId: string; timestamp: string };
};

export type ApiFailure = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
  meta: { requestId: string; timestamp: string };
};

export function e2eBaseUrl(): string {
  return inject('e2eBaseUrl');
}

export function e2eWsBaseUrl(): string {
  return inject('e2eWsBaseUrl');
}

export async function apiJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: T; headers: Headers }> {
  const res = await fetch(`${e2eBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const body = (await res.json()) as T;
  return { status: res.status, body, headers: res.headers };
}
