import type Konva from 'konva';
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Video, X } from 'lucide-react';
import { APP_NAME } from '../../shared/constants/app.constants';
import { dialogAlert } from '../../shared/components/DialogHost';
import { notifyWhenDone } from '../../shared/utils/notify';
import { toUserFacingError } from '../../shared/utils/user-facing-error';
import { useReplayExportStore } from '../../stores/replay-export.store';
import { exportReplayToVideo } from './record-replay-video';
import { ReplayController } from './ReplayController';
import { ReplayExportStage } from './ReplayExportStage';
import { yMapToObjects } from './y-map-to-objects';

/**
 * Owns background WebM export: offscreen Konva stage + progress chrome.
 * Survives exiting session replay so the live board and Yjs sync stay usable.
 */
export function ReplayExportHost() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const toastTimer = useRef<number | null>(null);

  const jobId = useReplayExportStore((s) => s.jobId);
  const active = useReplayExportStore((s) => s.active);
  const pct = useReplayExportStore((s) => s.pct);
  const panelOpen = useReplayExportStore((s) => s.panelOpen);
  const frozenView = useReplayExportStore((s) => s.frozenView);
  const size = useReplayExportStore((s) => s.size);
  const frameObjects = useReplayExportStore((s) => s.frameObjects);
  const toast = useReplayExportStore((s) => s.toast);
  const cancelRequested = useReplayExportStore((s) => s.cancelRequested);

  const showToast = (message: string) => {
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    useReplayExportStore.getState().setToast(message);
    toastTimer.current = window.setTimeout(() => {
      useReplayExportStore.getState().setToast(null);
      toastTimer.current = null;
    }, 4200);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!active || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    void Notification.requestPermission().catch(() => undefined);
  }, [active]);

  useEffect(() => {
    if (cancelRequested && abortRef.current) {
      abortRef.current.abort();
      useReplayExportStore.getState().clearCancel();
    }
  }, [cancelRequested]);

  useEffect(() => {
    if (jobId === 0) return;
    const request = useReplayExportStore.getState().request;
    if (!request) return;

    useReplayExportStore.getState().clearRequest();

    let cancelled = false;
    let finished = false;
    const abort = new AbortController();
    abortRef.current = abort;
    const controller = new ReplayController(request.entries);

    const run = async () => {
      // Wait a frame so the offscreen Stage mounts with frozen size/view.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      const stage = stageRef.current;
      if (!stage) {
        await dialogAlert('The board is not ready yet. Try again in a moment.', 'Export video');
        useReplayExportStore.getState().reset();
        return;
      }

      try {
        await exportReplayToVideo({
          stage,
          controller,
          roomId: request.roomId,
          view: request.view,
          signal: abort.signal,
          showIndex: (to) => {
            flushSync(() => {
              const map = controller.seek(to);
              useReplayExportStore.getState().setFrameObjects(yMapToObjects(map));
            });
          },
          onProgress: (p) => useReplayExportStore.getState().setPct(p),
        });
        if (!abort.signal.aborted && !cancelled) {
          showToast('Video saved as WebM. Share it in Slack, email, or Notion.');
          void notifyWhenDone({
            title: `${APP_NAME}: video ready`,
            body: 'Your session clip finished exporting and downloaded as WebM.',
            onlyWhenHidden: true,
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          showToast('Video export cancelled.');
        } else {
          const face = toUserFacingError(err, {
            title: 'Export video',
            message:
              'We could not export this recording as video. Try again, or save session history as JSON instead.',
          });
          await dialogAlert(face.message, { title: face.title, details: face.details });
        }
      } finally {
        finished = true;
        abortRef.current = null;
        controller.destroy();
        if (!cancelled) useReplayExportStore.getState().reset();
      }
    };

    void run();
    return () => {
      cancelled = true;
      abort.abort();
      if (!finished) controller.destroy();
    };
  }, [jobId]);

  if (!active) {
    return toast ? (
      <div className="app-toast" role="status" aria-live="polite">
        {toast}
      </div>
    ) : null;
  }

  return (
    <>
      <div className="replay-export-stage-host" aria-hidden="true">
        <ReplayExportStage
          stageRef={stageRef}
          objects={frameObjects}
          view={frozenView}
          size={size}
        />
      </div>

      {!panelOpen && (
        <button
          type="button"
          className="replay-export-chip replay-export-chip-floating"
          aria-label={`Video export ${pct} percent. Show progress.`}
          title="Show export progress"
          onClick={() => useReplayExportStore.getState().setPanelOpen(true)}
        >
          <Video size={14} strokeWidth={2.25} aria-hidden />
          <span>{pct >= 99 ? 'Saving…' : `${pct}%`}</span>
        </button>
      )}

      {panelOpen && (
        <div
          className="panel replay-export-progress"
          role="status"
          aria-live="polite"
          aria-labelledby="replay-export-title"
          aria-describedby="replay-export-desc"
        >
          <div className="replay-export-progress-head">
            <h2 id="replay-export-title" className="dialog-title">
              Exporting video
            </h2>
            <button
              type="button"
              className="replay-icon-btn"
              aria-label="Hide export progress"
              title="Hide"
              onClick={() => useReplayExportStore.getState().setPanelOpen(false)}
            >
              <X size={14} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
          <p id="replay-export-desc" className="dialog-message">
            {pct >= 99
              ? 'Saving the WebM file to your downloads…'
              : 'Rendering in the background. Exit replay anytime — keep this tab open until it finishes.'}
          </p>
          <div
            className="replay-export-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Video export progress"
          >
            <span className="replay-export-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="replay-export-progress-pct">
            {pct >= 99 && pct < 100 ? 'Saving…' : `${pct}%`}
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="btn"
              onClick={() => useReplayExportStore.getState().setPanelOpen(false)}
            >
              Hide
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => useReplayExportStore.getState().requestCancel()}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="app-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}
