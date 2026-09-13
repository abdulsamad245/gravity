import { AUDIO_LEVEL_BARS } from './useAudioRecorder';

interface Props {
  levels?: number[];
  /** Decorative bars when not live (e.g. playback chip). */
  idle?: boolean;
  /** 0–1 playback progress — bars before the playhead use the accent color. */
  progress?: number;
  className?: string;
  barCount?: number;
}

/** Compact vertical-bar waveform for recording / voice chips. */
export function AudioWaveBars({
  levels,
  idle = false,
  progress,
  className = '',
  barCount = AUDIO_LEVEL_BARS,
}: Props) {
  const bars =
    levels && levels.length
      ? levels
      : Array.from({ length: barCount }, (_, i) =>
          idle ? 0.22 + 0.18 * Math.sin(i * 0.7) : 0.12,
        );
  const playedThrough =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.max(0, Math.min(1, progress)) * bars.slice(0, barCount).length
      : -1;

  return (
    <div className={`audio-wave-bars ${idle ? 'idle' : ''} ${className}`.trim()} aria-hidden>
      {bars.slice(0, barCount).map((level, i) => (
        <span
          key={i}
          className={`audio-wave-bar${i < playedThrough ? ' played' : ''}`}
          style={{ transform: `scaleY(${Math.max(0.12, Math.min(1, level))})` }}
        />
      ))}
    </div>
  );
}
