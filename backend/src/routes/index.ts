import { Router } from 'express';
import { healthRouter } from './health.routes';
import { inviteRouter } from './invite.routes';
import { mediaRouter } from './media.routes';
import { orbitRouter } from './orbit.routes';
import { replayRouter } from './replay.routes';
import { roomRouter } from './room.routes';

export const apiRouter = Router();
apiRouter.use(healthRouter);
apiRouter.use(roomRouter);
apiRouter.use(replayRouter);
apiRouter.use(mediaRouter);
apiRouter.use(orbitRouter);
apiRouter.use(inviteRouter);
