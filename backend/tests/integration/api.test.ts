import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../src/app';

/**
 * Integration tests: the full Express pipeline (middleware, validation,
 * controllers, envelope shape) exercised in-process via createApp().
 */
let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('GET /api/v1/health', () => {
  it('reports ok inside the data envelope', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    expect(res.body.data).toMatchObject({ status: 'ok' });
    expect(res.body.data.rooms).toBeTypeOf('number');
    expect(res.body.data.clients).toBeTypeOf('number');
    expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(res.body.meta.requestId).toBeTypeOf('string');
    expect(res.body.meta.timestamp).toBeTypeOf('string');
  });
});

describe('GET /api/v1/replay/:room', () => {
  it('returns an empty log for a fresh room inside data', async () => {
    const res = await request(app).get('/api/v1/replay/freshroom1').expect(200);
    expect(res.body.data).toEqual({ room: 'freshroom1', count: 0, entries: [] });
  });

  it('rejects invalid room names with the API error envelope', async () => {
    const res = await request(app).get('/api/v1/replay/a b').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.requestId).toBeTypeOf('string');
    expect(res.body.meta.requestId).toBe(res.body.error.requestId);
  });
});

describe('GET /api/v1/rooms/:room/exists', () => {
  it('reports false for a fresh room id', async () => {
    const res = await request(app).get('/api/v1/rooms/fresh_exists_1/exists').expect(200);
    expect(res.body.data).toEqual({ room: 'fresh_exists_1', exists: false });
    expect(res.body.meta.requestId).toBeTypeOf('string');
  });
});

describe('POST /api/v1/invite', () => {
  it('accepts invites with a validated callUrl', async () => {
    const res = await request(app)
      .post('/api/v1/invite')
      .send({
        emails: ['teammate@example.com'],
        roomId: 'invite_room1',
        roomTitle: 'Invite demo',
        roomUrl: 'http://localhost:5173/rooms/invite_room1',
        inviterName: 'Ada',
        callUrl: 'https://meet.google.com/abc-defg-hij',
      })
      .expect(200);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.accepted).toBe(1);
    expect(['queued', 'deferred']).toContain(res.body.data.mode);
  });

  it('still succeeds when callUrl is junk (stripped at the boundary)', async () => {
    const res = await request(app)
      .post('/api/v1/invite')
      .send({
        emails: ['teammate@example.com'],
        roomId: 'invite_room2',
        roomTitle: 'Invite demo',
        roomUrl: 'http://localhost:5173/rooms/invite_room2',
        callUrl: 'https://ewwefwefwe/',
      })
      .expect(200);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.accepted).toBe(1);
    expect(['queued', 'deferred']).toContain(res.body.data.mode);
  });

  it('rejects invalid invite bodies with the error envelope', async () => {
    const res = await request(app)
      .post('/api/v1/invite')
      .send({ emails: ['nope'], roomId: 'x', roomUrl: 'not-a-url' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/media', () => {
  it('stores a tiny PDF data URL', async () => {
    // Minimal PDF bytes
    const pdf =
      'data:application/pdf;base64,JVBERi0xLjAKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbXS9Db3VudCAwPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxMCAwMDAwMCBuIAowMDAwMDAwMDYxIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMTEwCiUlRU9G';
    const res = await request(app)
      .post('/api/v1/media')
      .send({ dataUrl: pdf, mimeType: 'application/pdf' })
      .expect(201);
    expect(res.body.data.mimeType).toBe('application/pdf');
    expect(res.body.data.url).toMatch(/^\/api\/v1\/media\//);
  });
});

describe('cross-cutting middleware', () => {
  it('unknown API endpoints return the standard 404 error envelope', async () => {
    const res = await request(app).get('/api/v1/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('echoes an incoming X-Request-Id for end-to-end tracing', async () => {
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', 'trace-me-123');
    expect(res.headers['x-request-id']).toBe('trace-me-123');
    expect(res.body.meta.requestId).toBe('trace-me-123');
  });

  it('generates a request id when none is provided', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-request-id']).toMatch(/[0-9a-f-]{36}/);
  });

  it('serves the OpenAPI docs UI', async () => {
    await request(app).get('/api/docs/').expect(200);
  });

  it('exposes the OpenAPI JSON with all REST paths', async () => {
    const res = await request(app).get('/api/docs.json').expect(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.paths['/api/v1/invite']).toBeTruthy();
    expect(res.body.paths['/api/v1/rooms/{room}/exists']).toBeTruthy();
    expect(res.body.paths['/api/v1/orbit/chat/stream']).toBeTruthy();
    expect(res.body.components.schemas.InviteRequest.properties.callUrl).toBeTruthy();
  });
});
