/**
 * Soft looping ambient beds for the shared timer (Web Audio, no asset files).
 * Callers mute locally; music id is shared via awareness.
 */

type StopFn = () => void;

let stopCurrent: StopFn | null = null;
let currentId: string | null = null;

function ctx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    return new Ctx();
  } catch {
    return null;
  }
}

function startFocus(ac: AudioContext): StopFn {
  const master = ac.createGain();
  master.gain.value = 0.04;
  master.connect(ac.destination);

  const oscA = ac.createOscillator();
  const oscB = ac.createOscillator();
  const gA = ac.createGain();
  const gB = ac.createGain();
  oscA.type = 'sine';
  oscB.type = 'sine';
  oscA.frequency.value = 196;
  oscB.frequency.value = 246.94;
  gA.gain.value = 0.55;
  gB.gain.value = 0.35;
  oscA.connect(gA);
  oscB.connect(gB);
  gA.connect(master);
  gB.connect(master);
  oscA.start();
  oscB.start();

  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain);
  lfoGain.connect(master.gain);
  lfo.start();

  return () => {
    try {
      oscA.stop();
      oscB.stop();
      lfo.stop();
      void ac.close();
    } catch {
      /* ignore */
    }
  };
}

function startPulse(ac: AudioContext): StopFn {
  const master = ac.createGain();
  master.gain.value = 0.035;
  master.connect(ac.destination);

  let alive = true;
  const beat = () => {
    if (!alive) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 110;
    const t = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.4);
    window.setTimeout(beat, 720);
  };
  beat();

  return () => {
    alive = false;
    void ac.close().catch(() => undefined);
  };
}

function startCalm(ac: AudioContext): StopFn {
  const master = ac.createGain();
  master.gain.value = 0.03;
  master.connect(ac.destination);

  const freqs = [174.61, 220, 261.63];
  const oscs = freqs.map((f, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.value = 0.25 + i * 0.08;
    osc.connect(g);
    g.connect(master);
    osc.start();
    return osc;
  });

  return () => {
    try {
      oscs.forEach((o) => o.stop());
      void ac.close();
    } catch {
      /* ignore */
    }
  };
}

/** Start (or switch) the shared timer bed. Pass null / "none" to stop. */
export function syncTimerMusic(musicId: string | null | undefined, enabled: boolean): void {
  const id = enabled && musicId && musicId !== 'none' ? musicId : null;
  if (id === currentId) return;
  stopCurrent?.();
  stopCurrent = null;
  currentId = id;
  if (!id) return;

  const ac = ctx();
  if (!ac) return;
  void ac.resume().catch(() => undefined);

  if (id === 'pulse') stopCurrent = startPulse(ac);
  else if (id === 'calm') stopCurrent = startCalm(ac);
  else stopCurrent = startFocus(ac);
}

export function stopTimerMusic(): void {
  stopCurrent?.();
  stopCurrent = null;
  currentId = null;
}
