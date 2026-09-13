import { describe, expect, it } from 'vitest';
import { apiJson, e2eBaseUrl, type ApiFailure, type ApiSuccess } from '../helpers/http.js';

/** 1×1 PNG */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('HTTP black-box', () => {
  it('GET /api/v1/health returns the success envelope', async () => {
    const { status, body, headers } = await apiJson<
      ApiSuccess<{ status: string; uptimeSeconds: number; rooms: number; clients: number }>
    >('/api/v1/health');

    expect(status).toBe(200);
    expect(body.data.status).toBe('ok');
    expect(body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.data.rooms).toBeTypeOf('number');
    expect(body.data.clients).toBeTypeOf('number');
    expect(body.meta.requestId).toMatch(/[0-9a-f-]{8,}/i);
    expect(headers.get('x-request-id')).toBe(body.meta.requestId);
  });

  it('echoes X-Request-Id across the wire', async () => {
    const { body, headers } = await apiJson<ApiSuccess<unknown>>('/api/v1/health', {
      headers: { 'X-Request-Id': 'e2e-trace-42' },
    });
    expect(headers.get('x-request-id')).toBe('e2e-trace-42');
    expect(body.meta.requestId).toBe('e2e-trace-42');
  });

  it('GET /api/v1/rooms/:room/exists is false for a fresh id', async () => {
    const room = `e2e_room_${Date.now()}`;
    const { status, body } = await apiJson<ApiSuccess<{ room: string; exists: boolean }>>(
      `/api/v1/rooms/${room}/exists`,
    );
    expect(status).toBe(200);
    expect(body.data).toEqual({ room, exists: false });
  });

  it('GET /api/v1/replay/:room starts empty and rejects bad names', async () => {
    const room = `e2e_replay_${Date.now()}`;
    const empty = await apiJson<
      ApiSuccess<{ room: string; count: number; entries: unknown[] }>
    >(`/api/v1/replay/${room}`);
    expect(empty.status).toBe(200);
    expect(empty.body.data).toEqual({ room, count: 0, entries: [] });

    const bad = await apiJson<ApiFailure>('/api/v1/replay/bad room');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/media then GET bytes round-trips a tiny PNG', async () => {
    const created = await apiJson<
      ApiSuccess<{ id: string; mimeType: string; bytes: number; url: string }>
    >('/api/v1/media', {
      method: 'POST',
      body: JSON.stringify({ dataUrl: TINY_PNG, mimeType: 'image/png' }),
    });

    expect(created.status).toBe(201);
    expect(created.body.data.mimeType).toBe('image/png');
    expect(created.body.data.bytes).toBeGreaterThan(0);
    expect(created.body.data.url).toMatch(/^\/api\/v1\/media\//);

    const res = await fetch(`${e2eBaseUrl()}${created.body.data.url}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/image\/png/i);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.byteLength).toBe(created.body.data.bytes);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
  });

  it('POST /api/v1/invite succeeds in deferred mode without SMTP', async () => {
    const { status, body } = await apiJson<
      ApiSuccess<{ ok: boolean; accepted: number; mode: string }>
    >('/api/v1/invite', {
      method: 'POST',
      body: JSON.stringify({
        emails: ['teammate@example.com'],
        roomId: 'e2e_invite_room',
        roomTitle: 'E2E invite room',
        roomUrl: 'http://localhost:5173/rooms/e2e_invite_room',
        inviterName: 'E2E Bot',
      }),
    });

    expect(status).toBe(200);
    expect(body.data.ok).toBe(true);
    expect(body.data.accepted).toBe(1);
    // deferred when SMTP unset; queued when SMTP is configured
    expect(['deferred', 'queued']).toContain(body.data.mode);
  });

  it('POST /api/v1/invite accepts an optional Meet callUrl', async () => {
    const { status, body } = await apiJson<
      ApiSuccess<{ ok: boolean; accepted: number; mode: string }>
    >('/api/v1/invite', {
      method: 'POST',
      body: JSON.stringify({
        emails: ['teammate@example.com'],
        roomId: 'e2e_invite_call',
        roomTitle: 'E2E invite + call',
        roomUrl: 'http://localhost:5173/rooms/e2e_invite_call',
        inviterName: 'E2E Bot',
        callUrl: 'https://meet.google.com/abc-defg-hij',
      }),
    });

    expect(status).toBe(200);
    expect(body.data.ok).toBe(true);
    expect(body.data.accepted).toBe(1);
    expect(['deferred', 'queued']).toContain(body.data.mode);
  });

  it('GET /api/docs.json lists every REST path including invite.callUrl', async () => {
    const res = await fetch(`${e2eBaseUrl()}/api/docs.json`);
    expect(res.status).toBe(200);
    const spec = (await res.json()) as {
      paths: Record<string, unknown>;
      components: { schemas: { InviteRequest: { properties: { callUrl?: unknown } } } };
    };
    expect(spec.paths['/api/v1/health']).toBeTruthy();
    expect(spec.paths['/api/v1/invite']).toBeTruthy();
    expect(spec.paths['/api/v1/media']).toBeTruthy();
    expect(spec.paths['/api/v1/media/{id}']).toBeTruthy();
    expect(spec.paths['/api/v1/orbit/chat']).toBeTruthy();
    expect(spec.paths['/api/v1/orbit/chat/stream']).toBeTruthy();
    expect(spec.paths['/api/v1/replay/{room}']).toBeTruthy();
    expect(spec.paths['/api/v1/rooms/{room}/exists']).toBeTruthy();
    expect(spec.components.schemas.InviteRequest.properties.callUrl).toBeTruthy();
  });

  it('POST /api/v1/orbit/chat answers without an LLM key', async () => {
    const { status, body } = await apiJson<
      ApiSuccess<{ reply: string; provider: string }>
    >('/api/v1/orbit/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'How do I add a sticky note?' }),
    });

    expect(status).toBe(200);
    expect(body.data.reply.length).toBeGreaterThan(0);
    expect(['local', 'unavailable']).toContain(body.data.provider);
  });

  it('unknown API paths use the error envelope', async () => {
    const { status, body } = await apiJson<ApiFailure>('/api/v1/nope');
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.meta.requestId).toBe(body.error.requestId);
  });
});
