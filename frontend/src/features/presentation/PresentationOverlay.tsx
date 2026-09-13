import { ChevronLeft, ChevronRight, Circle, Grid2x2, Mic, MicOff, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dialogAlert } from '../../shared/components/DialogHost';
import { Tooltip } from '../../shared/components/Tooltip';
import type { CanvasObject } from '../../shared/types';
import { useViewStore } from '../../stores/view.store';
import { fitFrameInView, frameScreenRect, presentationFrames } from './presentation.utils';
import { usePresentationRecorder } from './usePresentationRecorder';

interface Props {
  objects: Record<string, CanvasObject>;
  index: number;
  roomId: string;
  onIndexChange: (index: number) => void;
  onExit: () => void;
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Presentation chrome: lightbox, prev/next, slide grid, exit, and talktrack recording. */
export function PresentationOverlay({ objects, index, roomId, onIndexChange, onExit }: Props) {
  const frames = presentationFrames(objects);
  const frame = frames[index];
  const view = useViewStore();
  const [gridOpen, setGridOpen] = useState(false);
  const [lightbox, setLightbox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const { recording, includeMic, setIncludeMic, seconds, start, stop } = usePresentationRecorder(roomId);

  useEffect(() => {
    if (!frame) return;
    fitFrameInView(frame);
  }, [frame?.id, index]);

  useEffect(() => {
    const sync = () => {
      if (!frame) return;
      setLightbox(frameScreenRect(frame));
    };
    sync();
    const unsub = useViewStore.subscribe(sync);
    window.addEventListener('resize', sync);
    return () => {
      unsub();
      window.removeEventListener('resize', sync);
    };
  }, [frame, view.x, view.y, view.scale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (gridOpen) setGridOpen(false);
        else {
          if (recording) stop();
          onExit();
        }
        return;
      }
      if (gridOpen) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        if (index < frames.length - 1) onIndexChange(index + 1);
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (index > 0) onIndexChange(index - 1);
      }
      if (e.key === 'Home') {
        e.preventDefault();
        onIndexChange(0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        onIndexChange(Math.max(0, frames.length - 1));
      }
      if (e.key === 'g' || e.key === 'G') setGridOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frames.length, gridOpen, index, onExit, onIndexChange, recording, stop]);

  if (frames.length === 0 || !frame) return null;

  const pad = 0;
  const L = Math.max(0, lightbox.left - pad);
  const T = Math.max(0, lightbox.top - pad);
  const R = Math.max(0, window.innerWidth - (lightbox.left + lightbox.width + pad));
  const B = Math.max(0, window.innerHeight - (lightbox.top + lightbox.height + pad));

  const exitPresentation = () => {
    if (recording) stop();
    onExit();
  };

  const toggleRecord = () => {
    if (recording) {
      stop();
      return;
    }
    void start().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        void dialogAlert(
          includeMic
            ? 'Allow screen and microphone access in your browser to record with audio.'
            : 'Allow screen sharing in your browser to record this presentation.',
          {
            title: 'Record presentation',
            details: `${err.name}: ${err.message}`,
          },
        );
        return;
      }
      const raw = err instanceof Error ? err.message : String(err);
      void dialogAlert('We could not start the presentation recording. Check browser permissions and try again.', {
        title: 'Record presentation',
        details: raw,
      });
    });
  };

  return (
    <div className="presentation-layer" role="region" aria-label="Presentation mode">
      <div className="presentation-dim presentation-dim-top" style={{ height: Math.max(0, T) }} />
      <div className="presentation-dim presentation-dim-bottom" style={{ height: Math.max(0, B) }} />
      <div
        className="presentation-dim presentation-dim-left"
        style={{ top: T, height: Math.max(0, lightbox.height), width: Math.max(0, L) }}
      />
      <div
        className="presentation-dim presentation-dim-right"
        style={{ top: T, height: Math.max(0, lightbox.height), width: Math.max(0, R) }}
      />

      <div className="presentation-top">
        <span className="presentation-title panel">
          {frame.text?.trim() || `Frame ${index + 1}`}
          <span className="presentation-count">
            {index + 1} / {frames.length}
          </span>
        </span>
        <div className="presentation-top-actions">
          {recording && (
            <span className="presentation-rec-badge panel" aria-live="polite">
              <Circle size={10} fill="currentColor" aria-hidden />
              Rec {formatSeconds(seconds)}
            </span>
          )}
          <Tooltip label="Exit presentation (Esc)" side="bottom" align="end">
            <button
              type="button"
              className="btn panel presentation-exit"
              onClick={exitPresentation}
              aria-label="Exit presentation"
            >
              <X size={18} strokeWidth={2} />
              Exit
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="presentation-bottom panel" role="toolbar" aria-label="Presentation controls">
        <Tooltip label="Previous frame (←)" side="top">
          <button
            type="button"
            className="chrome-btn"
            aria-label="Previous frame"
            disabled={index <= 0}
            onClick={() => onIndexChange(index - 1)}
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
        </Tooltip>
        <Tooltip label="Slide overview (G)" side="top">
          <button
            type="button"
            className={`chrome-btn${gridOpen ? ' active' : ''}`}
            aria-label="Open slides overview"
            aria-pressed={gridOpen}
            onClick={() => setGridOpen((v) => !v)}
          >
            <Grid2x2 size={18} strokeWidth={2} />
          </button>
        </Tooltip>
        <Tooltip label="Next frame (→)" side="top">
          <button
            type="button"
            className="chrome-btn"
            aria-label="Next frame"
            disabled={index >= frames.length - 1}
            onClick={() => onIndexChange(index + 1)}
          >
            <ChevronRight size={20} strokeWidth={2} />
          </button>
        </Tooltip>

        <span className="presentation-toolbar-sep" aria-hidden />

        <Tooltip
          label={
            recording
              ? 'Microphone cannot be changed while recording'
              : includeMic
                ? 'Your voice will be included'
                : 'Record without your voice'
          }
          side="top"
        >
          <button
            type="button"
            className={`chrome-btn${includeMic ? ' active' : ''}`}
            aria-label={includeMic ? 'Turn off microphone' : 'Turn on microphone'}
            aria-pressed={includeMic}
            disabled={recording}
            onClick={() => setIncludeMic(!includeMic)}
          >
            {includeMic ? <Mic size={18} strokeWidth={2} /> : <MicOff size={18} strokeWidth={2} />}
          </button>
        </Tooltip>
        <Tooltip label={recording ? 'Stop and download video' : 'Record this presentation'} side="top">
          <button
            type="button"
            className={`chrome-btn presentation-record-btn${recording ? ' recording' : ''}`}
            aria-label={recording ? 'Stop and download video' : 'Start recording presentation'}
            aria-pressed={recording}
            onClick={toggleRecord}
          >
            {recording ? <Square size={16} strokeWidth={2.25} /> : <Circle size={16} strokeWidth={2.25} />}
          </button>
        </Tooltip>
      </div>

      {gridOpen && (
        <div className="presentation-grid-backdrop" role="presentation" onClick={() => setGridOpen(false)}>
          <div
            className="presentation-grid panel"
            role="dialog"
            aria-label="Slides"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="presentation-grid-head">
              <h2>Slides</h2>
              <button type="button" className="btn" onClick={() => setGridOpen(false)}>
                Close
              </button>
            </div>
            <div className="presentation-grid-list">
              {frames.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  className={`presentation-slide-card${i === index ? ' current' : ''}`}
                  onClick={() => {
                    onIndexChange(i);
                    setGridOpen(false);
                  }}
                >
                  <span className="presentation-slide-num">{i + 1}</span>
                  <span className="presentation-slide-name">{f.text?.trim() || `Frame ${i + 1}`}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
