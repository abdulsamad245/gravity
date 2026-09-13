import { useCallback, useRef, useState } from 'react';
import { AUDIO_MAX_SECONDS } from '../../shared/constants/media.constants';
import { logger } from '../../shared/logging/logger';

export const AUDIO_LEVEL_BARS = 28;

interface AudioRecorderApi {
  recording: boolean;
  seconds: number;
  /** Live analyser levels 0–1 for waveform UI. */
  levels: number[];
  start: () => Promise<void>;
  stop: () => void;
}

function emptyLevels(): number[] {
  return Array.from({ length: AUDIO_LEVEL_BARS }, () => 0.12);
}

/**
 * Voice notes via the MediaRecorder API. Recordings are capped at
 * AUDIO_MAX_SECONDS and delivered as a data URL ready to store in the
 * shared document. Exposes live levels for a recording waveform.
 */
export function useAudioRecorder(
  onComplete: (dataUrl: string, seconds: number) => void,
): AudioRecorderApi {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(emptyLevels);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startedAt = useRef(0);

  const teardownMeter = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    setLevels(emptyLevels());
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    if (recording) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      logger.warn('Microphone access denied', err);
      throw err;
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    startedAt.current = Date.now();

    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(data);
          const next = emptyLevels();
          const step = Math.max(1, Math.floor(data.length / AUDIO_LEVEL_BARS));
          for (let i = 0; i < AUDIO_LEVEL_BARS; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += data[i * step + j] ?? 0;
            const avg = sum / step / 255;
            next[i] = Math.min(1, 0.1 + avg * 1.35);
          }
          setLevels(next);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch (err) {
      logger.warn('Audio analyser unavailable', err);
    }

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      teardownMeter();
      setRecording(false);
      setSeconds(0);

      const duration = Math.min(AUDIO_MAX_SECONDS, (Date.now() - startedAt.current) / 1000);
      // Strip codec params so data URLs stay `data:audio/webm;base64,...`
      // (parsers that only allow one `;` before base64 used to reject codecs=opus).
      const mime = (recorder.mimeType || 'audio/webm').split(';')[0]!.trim() || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      const reader = new FileReader();
      reader.onload = () => onComplete(reader.result as string, duration);
      reader.readAsDataURL(blob);
    };

    recorder.start();
    setRecording(true);
    setSeconds(0);
    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      setSeconds(Math.floor(elapsed));
      if (elapsed >= AUDIO_MAX_SECONDS) stop();
    }, 250);
  }, [recording, onComplete, stop, teardownMeter]);

  return { recording, seconds, levels, start, stop };
}
