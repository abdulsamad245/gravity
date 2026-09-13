import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AudioWaveBars } from './AudioWaveBars';

interface Props {
  src: string;
  durationSec?: number;
  name?: string;
  onRemove?: () => void;
  compact?: boolean;
}

/** Playable voice-note chip for chat / attachment lists. */
export function VoiceNoteChip({ src, durationSec, name, onRemove, compact }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const el = audioRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const dur = el.duration || durationSec || 0;
      setProgress(dur > 0 ? Math.min(1, el.currentTime / dur) : 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, durationSec]);

  const toggle = () => {
    let el = audioRef.current;
    if (!el) {
      el = new Audio(src);
      audioRef.current = el;
      el.onended = () => {
        setPlaying(false);
        setProgress(0);
      };
    }
    if (playing) {
      el.pause();
      el.currentTime = 0;
      setPlaying(false);
      setProgress(0);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  const secs = durationSec != null ? Math.round(durationSec) : null;
  const label =
    name ?? (secs != null ? `Voice note · ${secs}s` : 'Voice note');
  const timeLabel =
    playing && secs != null
      ? `${Math.max(0, secs - Math.round(progress * secs))}s`
      : secs != null
        ? `${secs}s`
        : null;

  return (
    <div className={`voice-note-chip${compact ? ' compact' : ''}`}>
      <button type="button" className="voice-note-play cursor-pointer" aria-label={playing ? 'Stop' : 'Play'} onClick={toggle}>
        {playing ? <Pause size={14} strokeWidth={2.25} /> : <Play size={14} strokeWidth={2.25} />}
      </button>
      <AudioWaveBars
        idle
        progress={progress}
        barCount={compact ? 16 : 22}
        className="voice-note-wave"
      />
      <span className="voice-note-label">{timeLabel ?? label}</span>
      {onRemove && (
        <button type="button" className="voice-note-remove cursor-pointer" aria-label="Remove voice note" onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  );
}
