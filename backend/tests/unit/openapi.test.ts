import { describe, expect, it } from 'vitest';
import { openApiSpec } from '../../src/docs/swagger';

type Spec = {
  paths?: Record<string, unknown>;
  tags?: Array<{ name: string }>;
  components?: { schemas?: Record<string, unknown> };
};

const spec = openApiSpec as Spec;

describe('OpenAPI / Swagger', () => {
  it('documents every REST endpoint under /api/v1', () => {
    const paths = Object.keys(spec.paths ?? {}).sort();
    expect(paths).toEqual(
      [
        '/api/v1/health',
        '/api/v1/invite',
        '/api/v1/media',
        '/api/v1/media/{id}',
        '/api/v1/orbit/chat',
        '/api/v1/orbit/chat/stream',
        '/api/v1/orbit/describe',
        '/api/v1/orbit/transcribe',
        '/api/v1/replay/{room}',
        '/api/v1/rooms/{room}/exists',
      ].sort(),
    );
  });

  it('includes Rooms + Invite tags and envelope schemas', () => {
    const tagNames = (spec.tags ?? []).map((t) => t.name);
    expect(tagNames).toEqual(
      expect.arrayContaining(['Health', 'Rooms', 'Replay', 'Media', 'Orbit', 'Invite']),
    );
    const schemas = spec.components?.schemas ?? {};
    expect(schemas).toHaveProperty('Meta');
    expect(schemas).toHaveProperty('ErrorEnvelope');
    expect(schemas).toHaveProperty('InviteRequest');
    expect(schemas).toHaveProperty('InviteData');
  });

  it('documents optional callUrl on invite requests', () => {
    const inviteReq = spec.components?.schemas?.InviteRequest as {
      properties?: { callUrl?: { description?: string } };
    };
    expect(inviteReq?.properties?.callUrl?.description).toMatch(/Meet|Zoom|Discord|Jitsi/i);
  });

  it('mentions docs.json in the API description', () => {
    const info = (openApiSpec as { info?: { description?: string } }).info;
    expect(info?.description).toMatch(/\/api\/docs\.json/);
  });
});
