import swaggerJsdoc from 'swagger-jsdoc';
import { APP_NAME } from '../constants/app.constants';

/**
 * OpenAPI 3 specification, generated from JSDoc annotations on the routes.
 * Served as interactive Swagger UI at /api/docs.
 */
export const openApiSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: `${APP_NAME} API`,
      version: '1.0.0',
      description: [
        `${APP_NAME} REST API for the collaborative infinite canvas.`,
        '',
        'All JSON responses use this envelope:',
        '- Success: `{ data, meta: { requestId, timestamp } }`',
        '- Error: `{ error: { code, message, requestId, details? }, meta }`',
        '',
        'Real-time collaboration uses WebSocket `/ws/<roomId>` (Yjs / y-websocket),',
        'not these REST routes. Optional guest headers: `x-guest-id`, `x-guest-name`.',
        '',
        'Machine-readable OpenAPI JSON: `GET /api/docs.json`. Interactive UI: `/api/docs`.',
      ].join('\n'),
    },
    tags: [
      { name: 'Health', description: 'Service health and metrics' },
      { name: 'Rooms', description: 'Room id allocation helpers' },
      { name: 'Replay', description: 'Time-travel session replay logs' },
      {
        name: 'Media',
        description: 'Durable board media (images, audio, short video, PDF/docs)',
      },
      { name: 'Orbit', description: 'Product-scoped canvas assistant' },
      { name: 'Invite', description: 'Room invite emails (optional call link)' },
    ],
    components: {
      schemas: {
        Meta: {
          type: 'object',
          required: ['requestId', 'timestamp'],
          properties: {
            requestId: { type: 'string', format: 'uuid' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ApiErrorBody: {
          type: 'object',
          required: ['code', 'message', 'requestId'],
          properties: {
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string' },
            requestId: { type: 'string' },
            details: {},
          },
        },
        ErrorEnvelope: {
          type: 'object',
          required: ['error', 'meta'],
          properties: {
            error: { $ref: '#/components/schemas/ApiErrorBody' },
            meta: { $ref: '#/components/schemas/Meta' },
          },
        },
        HealthData: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            uptimeSeconds: { type: 'integer' },
            rooms: { type: 'integer', description: 'Live rooms in memory' },
            clients: { type: 'integer', description: 'Connected WebSocket clients' },
          },
        },
        RoomExistsData: {
          type: 'object',
          properties: {
            room: { type: 'string' },
            exists: { type: 'boolean' },
          },
        },
        ReplayData: {
          type: 'object',
          properties: {
            room: { type: 'string' },
            count: { type: 'integer' },
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  t: { type: 'integer', description: 'Unix ms timestamp' },
                  u: { type: 'string', description: 'base64 Yjs update' },
                },
              },
            },
          },
        },
        MediaStoredData: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            mimeType: { type: 'string' },
            bytes: { type: 'integer' },
            url: { type: 'string', example: '/api/v1/media/…' },
          },
        },
        InviteData: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
            accepted: { type: 'integer' },
            mode: {
              type: 'string',
              enum: ['queued', 'deferred'],
              description:
                'queued = accepted into the background SMTP queue; deferred = SMTP unset (logged only)',
            },
          },
        },
        InviteRequest: {
          type: 'object',
          required: ['emails', 'roomId', 'roomUrl'],
          properties: {
            emails: {
              type: 'array',
              items: { type: 'string', format: 'email' },
              minItems: 1,
            },
            roomId: { type: 'string', minLength: 4, maxLength: 64 },
            roomTitle: { type: 'string', maxLength: 120 },
            roomUrl: { type: 'string', format: 'uri', maxLength: 2000 },
            inviterName: { type: 'string', maxLength: 80 },
            callUrl: {
              type: 'string',
              format: 'uri',
              maxLength: 2048,
              description:
                'Optional Meet / Zoom / Discord / Teams / Whereby / Webex / Jitsi / Skype link included in the email',
              example: 'https://meet.google.com/abc-defg-hij',
            },
          },
        },
        OrbitChatRequest: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            context: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  label: { type: 'string' },
                },
              },
            },
            attachments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  mimeType: { type: 'string' },
                  text: { type: 'string' },
                },
              },
            },
          },
        },
        OrbitChatData: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            provider: { type: 'string' },
            model: { type: 'string' },
            ops: { type: 'array', items: { type: 'object' } },
          },
        },
      },
      parameters: {
        RoomId: {
          in: 'path',
          name: 'room',
          required: true,
          schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{4,64}$' },
          description: 'Room identifier (URL-safe, 4-64 chars)',
        },
        MediaId: {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', pattern: '^[a-f0-9]{16,64}\\.[a-z0-9]{2,8}$' },
          description: 'Durable media id (hash + extension)',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
});
