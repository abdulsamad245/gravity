import type Konva from 'konva';
import { APP_NAME } from '../../shared/constants/app.constants';
import { logger } from '../../shared/logging/logger';
import type { CanvasObject } from '../../shared/types';
import { downloadBlob } from '../../shared/utils/download';
import { resolveMediaUrl } from '../../shared/utils/media-url';
import { canvasThemeColors, useThemeStore } from '../../stores/theme.store';
import { useUiStore } from '../../stores/ui.store';
import { useViewStore } from '../../stores/view.store';
import type { ReplayExportView } from '../../stores/replay-export.store';
import type { ReplayController } from './ReplayController';
import { replayExportStepDelayMs } from './replay-export-timing';

const EXPORT_FPS = 30;
const FRAME_MS = 1000 / EXPORT_FPS;

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
    return null;
  }
  if (!HTMLCanvasElement.prototype.captureStream) return null;
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return 'video/webm;codecs=vp8';
  if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';
  return null;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let left = count;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

export type ReplayVideoExportOptions = {
  stage: Konva.Stage;
  controller: ReplayController;
  roomId: string;
  /** Apply board state for this step (usually seek + React update). */
  showIndex: (index: number) => void;
  /** Camera freeze for the clip (defaults to live view store). */
  view?: ReplayExportView;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
};

/**
 * Builds a WebM that matches on-screen replay: Konva snapshot at 1:1 CSS pixels
 * (no HiDPI buffer stretch), plus HTML board images, held per replay step.
 */
export async function exportReplayToVideo(options: ReplayVideoExportOptions): Promise<void> {
  const { stage, controller, roomId, showIndex, onProgress, signal } = options;
  const view = options.view ?? useViewStore.getState();
  if (controller.length === 0) {
    throw new Error('Nothing to export');
  }

  const mime = pickMimeType();
  if (!mime) {
    throw new Error('This browser cannot encode WebM video. Try Chrome or Edge.');
  }

  const { bg } = canvasThemeColors(
    useThemeStore.getState().resolved,
    useUiStore.getState().canvasBg,
  );

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a canvas for video export');

  const overlay = stage.findOne('.overlay');
  const overlayWasVisible = overlay?.visible() ?? true;
  overlay?.visible(false);
  stage.batchDraw();

  const imageCache = new Map<string, HTMLImageElement>();

  const paint = () => {
    const width = Math.max(1, Math.round(stage.width()));
    const height = Math.max(1, Math.round(stage.height()));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    stage.batchDraw();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    try {
      // pixelRatio 1 = CSS pixels, same framing as the live board (avoids
      // stretched HiDPI layer buffers that look like shadows / wrong zoom).
      const snap = stage.toCanvas({ pixelRatio: 1 });
      ctx.drawImage(snap, 0, 0, width, height);
    } catch (err) {
      logger.warn('Replay video stage snapshot failed; drawing layers', err);
      paintLayersScaled(stage, ctx, width, height);
    }

    paintBoardImages(ctx, controller, imageCache, view);
  };

  // Manual frames when supported so we only encode settled board states.
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  const requestFrame =
    track && typeof track.requestFrame === 'function' ? () => track.requestFrame() : null;

  // Fallback browsers: timed captureStream; we still only paint settled frames.
  let timedStream: MediaStream | null = null;
  let recordStream = stream;
  if (!requestFrame) {
    timedStream = canvas.captureStream(EXPORT_FPS);
    recordStream = timedStream;
    for (const t of stream.getTracks()) t.stop();
  }

  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(recordStream, {
      mimeType: mime,
      videoBitsPerSecond: 2_500_000,
    });
  } catch (err) {
    for (const t of recordStream.getTracks()) t.stop();
    overlay?.visible(overlayWasVisible);
    stage.batchDraw();
    logger.error('MediaRecorder init failed', err);
    throw new Error('This browser could not start video encoding. Try Chrome or Edge.');
  }

  let settleStop: () => void = () => undefined;
  const stopped = new Promise<void>((resolve, reject) => {
    settleStop = resolve;
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error('Video encoding failed while recording.'));
  });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  try {
    recorder.start(100);
  } catch (err) {
    for (const t of recordStream.getTracks()) t.stop();
    overlay?.visible(overlayWasVisible);
    stage.batchDraw();
    logger.error('MediaRecorder start failed', err);
    throw new Error('This browser could not start video encoding. Try Chrome or Edge.');
  }

  const pushFrame = () => {
    paint();
    requestFrame?.();
  };

  /** Hold a settled frame for `ms` so pacing matches replay, without mid-update ghosts. */
  const holdFrame = async (ms: number) => {
    const until = performance.now() + Math.max(FRAME_MS, ms);
    pushFrame();
    while (performance.now() < until) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      await wait(FRAME_MS, signal);
      pushFrame();
    }
  };

  try {
    const total = controller.length;
    showIndex(0);
    await waitFrames(3);
    await warmImageCache(controller, imageCache);
    onProgress?.(0);
    await holdFrame(replayExportStepDelayMs(controller, 0));

    for (let i = 1; i <= total; i += 1) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      showIndex(i);
      await waitFrames(3);
      await warmImageCache(controller, imageCache);
      await holdFrame(replayExportStepDelayMs(controller, i));
      onProgress?.(Math.min(99, Math.round((i / total) * 99)));
    }

    onProgress?.(99);
  } finally {
    try {
      await stopMediaRecorder(recorder, stopped, settleStop, signal);
    } finally {
      for (const t of recordStream.getTracks()) t.stop();
      overlay?.visible(overlayWasVisible);
      stage.batchDraw();
    }
  }

  if (signal?.aborted) return;

  const blob = new Blob(chunks, { type: 'video/webm' });
  if (blob.size === 0) throw new Error('Video export produced an empty file');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadBlob(blob, `${APP_NAME.toLowerCase()}-replay-${roomId}-${stamp}.webm`);
  onProgress?.(100);
}

/** Scale native HiDPI layer buffers down to CSS stage size (fallback path). */
function paintLayersScaled(
  stage: Konva.Stage,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  for (const layer of stage.getLayers()) {
    if (layer.name() === 'overlay') continue;
    try {
      const el = layer.getNativeCanvasElement();
      ctx.drawImage(el, 0, 0, width, height);
    } catch (err) {
      logger.warn('Replay video frame skipped a layer', err);
    }
  }
}

function listImageObjects(controller: ReplayController): CanvasObject[] {
  const out: CanvasObject[] = [];
  controller.objects.forEach((value) => {
    const obj = value.toJSON() as CanvasObject;
    if (obj.type === 'image' && obj.src) out.push(obj);
  });
  return out;
}

async function warmImageCache(
  controller: ReplayController,
  cache: Map<string, HTMLImageElement>,
): Promise<void> {
  await Promise.all(
    listImageObjects(controller).map(async (obj) => {
      const url = resolveMediaUrl(obj.src);
      if (!url || cache.has(url)) return;
      const img = await loadImageElement(url);
      if (img) cache.set(url, img);
    }),
  );
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Board images live in an HTML overlay; draw them in the same screen space as live replay. */
function paintBoardImages(
  ctx: CanvasRenderingContext2D,
  controller: ReplayController,
  cache: Map<string, HTMLImageElement>,
  view: ReplayExportView,
): void {
  for (const obj of listImageObjects(controller)) {
    const url = resolveMediaUrl(obj.src);
    const img = url ? cache.get(url) : undefined;
    if (!img) continue;

    const left = obj.x * view.scale + view.x;
    const top = obj.y * view.scale + view.y;
    const width = Math.max(1, obj.width * view.scale);
    const height = Math.max(1, obj.height * view.scale);
    const opacity = typeof obj.opacity === 'number' ? obj.opacity : 1;

    ctx.save();
    ctx.globalAlpha = opacity;
    if (obj.rotation) {
      ctx.translate(left, top);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      ctx.drawImage(img, 0, 0, width, height);
    } else {
      ctx.drawImage(img, left, top, width, height);
    }
    ctx.restore();
  }
}

/** Stop encoding without hanging forever if onstop never fires. */
async function stopMediaRecorder(
  recorder: MediaRecorder,
  stopped: Promise<void>,
  forceSettle: () => void,
  signal?: AbortSignal,
): Promise<void> {
  const STOP_TIMEOUT_MS = 4_000;
  try {
    if (recorder.state === 'recording') {
      try {
        recorder.requestData();
      } catch {
        /* some browsers throw if a timeslice flush is already pending */
      }
    }
    if (recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      forceSettle();
      return;
    }

    await Promise.race([
      stopped,
      wait(STOP_TIMEOUT_MS).then(() => {
        logger.warn('MediaRecorder stop timed out; saving whatever chunks we have');
        forceSettle();
      }),
      signal
        ? new Promise<void>((_, reject) => {
            if (signal.aborted) {
              reject(new DOMException('Aborted', 'AbortError'));
              return;
            }
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          })
        : new Promise<void>(() => undefined),
    ]);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    logger.warn('Replay video recorder cleanup', err);
    forceSettle();
  }
}
