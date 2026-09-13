import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_NAME } from '../../shared/constants/app.constants';
import { logger } from '../../shared/logging/logger';
import { downloadBlob } from '../../shared/utils/download';

interface PresentationRecorderApi {
  recording: boolean;
  includeMic: boolean;
  setIncludeMic: (value: boolean) => void;
  seconds: number;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Talktrack-style capture for presentation mode: tab/window video via
 * getDisplayMedia, optional mic, download as WebM when stopped.
 */
export function usePresentationRecorder(roomId: string): PresentationRecorderApi {
  const [recording, setRecording] = useState(false);
  const [includeMic, setIncludeMic] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  const cleanup = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    for (const stream of streamsRef.current) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamsRef.current = [];
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    recorderRef.current = null;
    setRecording(false);
    setSeconds(0);
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cleanup();
      return;
    }
    recorder.stop();
  }, [cleanup]);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(async () => {
    if (recorderRef.current) return;

    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
    } catch (err) {
      logger.warn('Display capture cancelled or denied', err);
      throw err;
    }

    const owned: MediaStream[] = [display];
    let mic: MediaStream | null = null;
    if (includeMic) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        owned.push(mic);
      } catch (err) {
        for (const stream of owned) {
          for (const track of stream.getTracks()) track.stop();
        }
        logger.warn('Microphone access denied for presentation recording', err);
        throw err;
      }
    }

    const videoTrack = display.getVideoTracks()[0];
    if (!videoTrack) {
      for (const stream of owned) {
        for (const track of stream.getTracks()) track.stop();
      }
      throw new Error('No video track from display capture');
    }

    videoTrack.addEventListener('ended', () => {
      recorderRef.current?.stop();
    });

    const audioInputs = [...display.getAudioTracks(), ...(mic?.getAudioTracks() ?? [])];
    let recordStream: MediaStream;
    if (audioInputs.length <= 1) {
      recordStream = new MediaStream([videoTrack, ...audioInputs]);
    } else {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) {
        recordStream = new MediaStream([videoTrack, audioInputs[0]!]);
      } else {
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        for (const track of audioInputs) {
          const part = new MediaStream([track]);
          owned.push(part);
          ctx.createMediaStreamSource(part).connect(dest);
        }
        recordStream = new MediaStream([videoTrack, ...dest.stream.getAudioTracks()]);
      }
    }

    streamsRef.current = owned;
    const chunks: Blob[] = [];
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';
    const recorder = new MediaRecorder(recordStream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime.includes('webm') ? 'video/webm' : mime });
      if (blob.size > 0) {
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        downloadBlob(
          blob,
          `${APP_NAME.toLowerCase()}-talktrack-${roomIdRef.current}-${stamp}.webm`,
        );
      }
      cleanup();
    };

    recorder.start(1000);
    setRecording(true);
    setSeconds(0);
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
  }, [cleanup, includeMic]);

  return { recording, includeMic, setIncludeMic, seconds, start, stop };
}
