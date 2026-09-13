import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LLM_RATE_LIMIT } from '../constants/llm.constants';
import {
  postOrbitChat,
  postOrbitChatStream,
  postOrbitDescribe,
  postOrbitTranscribe,
} from '../controllers/orbit.controller';
import { validateBody } from '../middleware/validate.middleware';
import {
  orbitChatBodySchema,
  orbitDescribeBodySchema,
  orbitTranscribeBodySchema,
} from '../validators/orbit.validators';

export const orbitRouter = Router();

const orbitLimiter = rateLimit({
  ...LLM_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many assistant requests. Try again shortly.' } },
});

/**
 * @openapi
 * /api/v1/orbit/chat:
 *   post:
 *     summary: Ask Orbit (product-scoped canvas assistant)
 *     tags: [Orbit]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrbitChatRequest'
 *     responses:
 *       200:
 *         description: Assistant reply (success envelope)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [data, meta]
 *               properties:
 *                 data: { $ref: '#/components/schemas/OrbitChatData' }
 *                 meta: { $ref: '#/components/schemas/Meta' }
 *       400:
 *         description: Invalid body
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       429:
 *         description: Rate limited
 */
orbitRouter.post('/orbit/chat', orbitLimiter, validateBody(orbitChatBodySchema), postOrbitChat);

/**
 * @openapi
 * /api/v1/orbit/transcribe:
 *   post:
 *     summary: Transcribe an Orbit voice note (Whisper)
 *     tags: [Orbit]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dataUrl]
 *             properties:
 *               dataUrl: { type: string, description: data:audio/...;base64,... payload }
 *               mimeType: { type: string }
 *     responses:
 *       200:
 *         description: Transcript text (success envelope)
 *       400:
 *         description: Invalid audio
 *       429:
 *         description: Rate limited
 *       503:
 *         description: LLM not configured
 */
orbitRouter.post(
  '/orbit/transcribe',
  orbitLimiter,
  validateBody(orbitTranscribeBodySchema),
  postOrbitTranscribe,
);

/**
 * @openapi
 * /api/v1/orbit/describe:
 *   post:
 *     summary: Describe an Orbit image attachment (vision)
 *     tags: [Orbit]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dataUrl]
 *             properties:
 *               dataUrl: { type: string, description: data:image/...;base64,... payload }
 *               mimeType: { type: string }
 *     responses:
 *       200:
 *         description: Image description text (success envelope)
 *       400:
 *         description: Invalid image
 *       429:
 *         description: Rate limited
 *       503:
 *         description: LLM not configured
 */
orbitRouter.post(
  '/orbit/describe',
  orbitLimiter,
  validateBody(orbitDescribeBodySchema),
  postOrbitDescribe,
);

/**
 * @openapi
 * /api/v1/orbit/chat/stream:
 *   post:
 *     summary: Ask Orbit with SSE token streaming
 *     description: >
 *       Same body as `/orbit/chat`. Response is `text/event-stream` with
 *       status, delta, done, or error events (not the JSON envelope).
 *     tags: [Orbit]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrbitChatRequest'
 *     responses:
 *       200:
 *         description: text/event-stream of status, delta, done, or error events
 *         content:
 *           text/event-stream:
 *             schema: { type: string }
 *       400:
 *         description: Invalid body (JSON error envelope)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       429:
 *         description: Rate limited
 */
orbitRouter.post(
  '/orbit/chat/stream',
  orbitLimiter,
  validateBody(orbitChatBodySchema),
  postOrbitChatStream,
);
