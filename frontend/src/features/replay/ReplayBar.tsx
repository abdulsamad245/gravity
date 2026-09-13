import { Download, FastForward, Pause, Play, Rewind, SkipBack, Video, X } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type Konva from 'konva';
import type * as Y from 'yjs';
import { dialogAlert } from '../../shared/components/DialogHost';
import { APP_NAME } from '../../shared/constants/app.constants';
import { REPLAY_SKIP_MS, REPLAY_START_HOLD_MS } from '../../shared/constants/replay.constants';
import { downloadText } from '../../shared/utils/download';
import { useReplayExportStore } from '../../stores/replay-export.store';
import { useViewStore } from '../../stores/view.store';
import type { ReplayController } from './ReplayController';

interface Props {
  controller: ReplayController;
  roomId: string;
  stageRef: RefObject<Konva.Stage | null>;
  onUpdate: (map: Y.Map<Y.Map<unknown>>) => void;
  onExit: () => void;
}

const REPLAY_SPEEDS = [0.5, 1, 2, 4, 8] as const;
type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

function timeAtIndex(controller: ReplayController, index: number): number {
  const { entries } = controller;
  if (entries.length === 0) return 0;
  if (index <= 0) return entries[0]!.t;
  return entries[Math.min(index, entries.length) - 1]!.t;
}

function indexAtTime(controller: ReplayController, time: number): number {
  let i = 0;
  while (i < controller.length && controller.entries[i]!.t <= time) i += 1;
  return i;
}

export function ReplayBar({ controller, roomId, stageRef, onUpdate, onExit }: Props) {
  const [index, setIndex] = useState(0);
  /** Auto-play from the start when the user opens session replay. */
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  /** Bumped when skipping while playing so the timeline restarts from the new index. */
  const [playToken, setPlayToken] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);
  const exportActive = useReplayExportStore((s) => s.active);

  const showToast = (message: string) => {
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 4200);
  };

  const seek = (to: number) => {
    const map = controller.seek(to);
    setIndex(controller.index);
    onUpdate(map);
  };

  const skipBy = (deltaMs: number) => {
    if (controller.length === 0) return;
    const from = controller.index;
    const targetTime = timeAtIndex(controller, from) + deltaMs;
    let next = indexAtTime(controller, targetTime);

    // Replay logs often have gaps longer than REPLAY_SKIP_MS. A pure time jump
    // then stays put — fast-forward looks broken. Always move at least one step.
    if (deltaMs > 0 && next <= from) {
      next = Math.min(controller.length, from + 1);
    } else if (deltaMs < 0 && next >= from) {
      next = Math.max(0, from - 1);
    }

    if (next === from) return;
    seek(next);
    if (playing) setPlayToken((token) => token + 1);
  };

  useEffect(() => {
    if (!playing) return;
    if (controller.length === 0) {
      setPlaying(false);
      return;
    }

    const startIndex = controller.index;
    const timelineStart =
      startIndex > 0
        ? controller.entries[startIndex - 1]!.t
        : controller.entries[0]!.t - REPLAY_START_HOLD_MS;

    const playbackStart = performance.now();
    let animationFrame = 0;
    const advance = (now: number) => {
      const replayTime = timelineStart + (now - playbackStart) * speed;
      if (
        controller.index < controller.length &&
        controller.entries[controller.index]!.t <= replayTime
      ) {
        seek(controller.index + 1);
      }

      if (controller.index >= controller.length) {
        setPlaying(false);
      } else {
        animationFrame = window.requestAnimationFrame(advance);
      }
    };
    animationFrame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(animationFrame);
    // seek/controller are stable enough for this playback loop
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playToken restarts the loop after seeks
  }, [playing, speed, playToken]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        if (!playing && index >= controller.length) seek(0);
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playing]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const cycleSpeed = () => {
    const i = REPLAY_SPEEDS.indexOf(speed);
    setSpeed(REPLAY_SPEEDS[(i + 1) % REPLAY_SPEEDS.length]!);
  };

  const ts = controller.timestampAt(index - 1);
  const max = Math.max(0, controller.length);
  const pct = max > 0 ? Math.min(100, (index / max) * 100) : 0;

  const downloadReplay = () => {
    setExportOpen(false);
    const exportedAt = new Date().toISOString();
    downloadText(
      JSON.stringify(
        {
          app: APP_NAME,
          kind: 'session-replay',
          version: 1,
          room: roomId,
          exportedAt,
          count: controller.entries.length,
          entries: controller.entries,
        },
        null,
        2,
      ),
      `${APP_NAME.toLowerCase()}-replay-${roomId}-${exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`,
      'application/json',
    );
    void dialogAlert(
      'Saved a session history file for Gravity. Open it later from More → Board → Open session history to scrub inside the app. For a shareable clip, use Export → Video.',
      'Session history saved',
    );
  };

  const exportVideo = async () => {
    setExportOpen(false);
    if (exportActive) {
      useReplayExportStore.getState().requestCancel();
      showToast('Video export cancelled.');
      return;
    }

    const stage = stageRef.current;
    if (!stage) {
      await dialogAlert('The board is not ready yet. Try again in a moment.', 'Export video');
      return;
    }
    if (controller.length === 0) {
      await dialogAlert('There is nothing to export yet.', 'Export video');
      return;
    }

    const view = useViewStore.getState();
    const started = useReplayExportStore.getState().requestExport({
      entries: controller.entries,
      roomId,
      view: { x: view.x, y: view.y, scale: view.scale },
      size: {
        w: Math.max(1, Math.round(stage.width())),
        h: Math.max(1, Math.round(stage.height())),
      },
    });
    if (!started) {
      showToast('A video export is already running.');
      return;
    }
    setPlaying(false);
    showToast('Exporting video in the background. Exit replay anytime — keep this tab open.');
  };

  const skipSeconds = Math.round(REPLAY_SKIP_MS / 1000);

  return (
    <>
      <div className="replay-bar panel" role="region" aria-label="Session replay">
        <div className="replay-bar-controls">
          <button
            type="button"
            className="replay-icon-btn"
            aria-label="Restart"
            title="Restart"
            onClick={() => {
              setPlaying(false);
              seek(0);
            }}
          >
            <SkipBack size={16} strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            className="replay-icon-btn"
            aria-label={`Rewind ${skipSeconds} seconds`}
            title={`Rewind ${skipSeconds}s`}
            onClick={() => skipBy(-REPLAY_SKIP_MS)}
          >
            <Rewind size={16} strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            className="replay-icon-btn replay-play"
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause' : 'Play'}
            onClick={() => {
              if (!playing && index >= controller.length) seek(0);
              setPlaying(!playing);
            }}
          >
            {playing ? (
              <Pause size={16} strokeWidth={2.25} aria-hidden />
            ) : (
              <Play size={16} strokeWidth={2.25} aria-hidden />
            )}
          </button>
          <button
            type="button"
            className="replay-icon-btn"
            aria-label={`Fast forward ${skipSeconds} seconds`}
            title={`Fast forward ${skipSeconds}s`}
            onClick={() => skipBy(REPLAY_SKIP_MS)}
          >
            <FastForward size={16} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <label className="replay-scrub">
          <span className="sr-only">Replay position</span>
          <span className="replay-scrub-track" aria-hidden>
            <span className="replay-scrub-fill" style={{ width: `${pct}%` }} />
          </span>
          <input
            type="range"
            min={0}
            max={max}
            value={index}
            onChange={(e) => {
              setPlaying(false);
              seek(Number(e.target.value));
            }}
          />
        </label>

        <span className="replay-label" aria-live="polite">
          <strong>
            {index}/{max}
          </strong>
          {ts ? <span>{new Date(ts).toLocaleTimeString()}</span> : null}
        </span>

        <button
          type="button"
          className="replay-speed"
          aria-label={`Playback speed ${speed}×. Click to change.`}
          title="Playback speed"
          onClick={cycleSpeed}
        >
          {speed}×
        </button>

        <div className="replay-export" ref={exportMenuRef}>
          <button
            type="button"
            className={`replay-icon-btn${exportOpen ? ' open' : ''}${exportActive ? ' open' : ''}`}
            aria-label={exportActive ? 'Cancel video export' : 'Export'}
            title={exportActive ? 'Cancel video export' : 'Export'}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            onClick={() => {
              if (exportActive) {
                useReplayExportStore.getState().requestCancel();
                showToast('Video export cancelled.');
                return;
              }
              setExportOpen((open) => !open);
            }}
          >
            {exportActive ? (
              <Video size={16} strokeWidth={2.1} aria-hidden />
            ) : (
              <Download size={16} strokeWidth={2.1} aria-hidden />
            )}
          </button>
          {exportOpen && !exportActive && (
            <div className="export-dropdown panel replay-export-menu" role="menu">
              <button
                type="button"
                className="tool-flyout-item"
                role="menuitem"
                onClick={downloadReplay}
              >
                <Download size={16} /> Save session history
              </button>
              <button
                type="button"
                className="tool-flyout-item"
                role="menuitem"
                onClick={() => void exportVideo()}
              >
                <Video size={16} /> Video
              </button>
            </div>
          )}
        </div>

        <button type="button" className="replay-exit" onClick={onExit}>
          <X size={14} strokeWidth={2.25} aria-hidden />
          Exit
        </button>
      </div>

      {toast && (
        <div className="app-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}
