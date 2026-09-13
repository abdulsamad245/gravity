import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';

export const healthRouter = Router();

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     summary: Health check and lightweight metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy (success envelope)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [data, meta]
 *               properties:
 *                 data: { $ref: '#/components/schemas/HealthData' }
 *                 meta: { $ref: '#/components/schemas/Meta' }
 */
healthRouter.get('/health', getHealth);
