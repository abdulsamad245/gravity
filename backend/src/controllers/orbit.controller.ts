import type { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../shared/http/api-response';
import { describeOrbitImage } from '../services/orbit-describe.service';
import { chatWithOrbit, streamChatWithOrbit } from '../services/orbit.service';
import { transcribeOrbitAudio } from '../services/orbit-transcribe.service';
import type { OrbitChatBody, OrbitDescribeBody, OrbitTranscribeBody } from '../validators/orbit.validators';

/** Non-streaming Orbit chat; responds with the JSON API envelope. */
export async function postOrbitChat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as OrbitChatBody;
    const data = await chatWithOrbit(body);
    ApiResponse.ok(res, data);
  } catch (err) {
    next(err);
  }
}

/** Whisper (or compatible) transcript for an Orbit voice note. */
export async function postOrbitTranscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as OrbitTranscribeBody;
    const text = await transcribeOrbitAudio(body.dataUrl, body.mimeType);
    ApiResponse.ok(res, { text });
  } catch (err) {
    next(err);
  }
}

/** Vision describe for an Orbit image attachment. */
export async function postOrbitDescribe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as OrbitDescribeBody;
    const text = await describeOrbitImage(body.dataUrl, body.mimeType);
    ApiResponse.ok(res, { text });
  } catch (err) {
    next(err);
  }
}

/** Server-Sent Events stream of Orbit deltas (thinking → tokens → done). */
export async function postOrbitChatStream(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as OrbitChatBody;

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    for await (const event of streamChatWithOrbit(body)) {
      if (closed) break;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    if (!closed && !res.writableEnded) res.end();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
      return;
    }
    if (!res.writableEnded) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: 'Stream failed.', provider: 'unavailable' })}\n\n`,
      );
      res.end();
    }
  }
}
