import { Square } from 'lucide-react';
import { AUDIO_MAX_SECONDS } from '../../shared/constants/media.constants';
import { AudioWaveBars } from './AudioWaveBars';

interface Props {
  seconds: number;
  levels: number[];
  onStop: () => void;
  /** Extra class for placement (toolbar HUD vs chat composer). */
  className?: string;
}

/** Live recording strip: timer + waveform + stop. */
export function VoiceRecordStrip({ seconds, levels, onStop, className = '' }: Props) {
  const left = Math.max(0, AUDIO_MAX_SECONDS - seconds);
  return (
    <div className={`voice-record-strip ${className}`.trim()} role="status" aria-live="polite">
      <span className="voice-record-dot" aria-hidden />
      <span className="voice-record-time">
        {seconds}s <em>/ {AUDIO_MAX_SECONDS}s</em>
      </span>
      <AudioWaveBars levels={levels} className="voice-record-wave" />
      <button type="button" className="voice-record-stop cursor-pointer" aria-label="Stop recording" onClick={onStop}>
        <Square size={12} strokeWidth={2.5} fill="currentColor" aria-hidden />
        Stop
      </button>
      {left <= 3 && <span className="voice-record-cap">max soon</span>}
    </div>
  );
}
