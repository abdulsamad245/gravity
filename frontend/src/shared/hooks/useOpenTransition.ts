import { useCallback, useEffect, useRef, useState } from 'react';
import { MOTION_MS } from '../constants/motion.constants';

export type MotionPhase = 'enter' | 'open' | 'exit';

export { MOTION_MS };

/**
 * Fresh mount: enter → open. requestClose: exit → onClose after duration.
 * Pair with `.anim-io.anim-io-{phase}` classes.
 */
export function useOpenTransition(onClose?: () => void, durationMs = MOTION_MS) {
  const [phase, setPhase] = useState<MotionPhase>('enter');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closing = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('open'));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setPhase('exit');
    window.setTimeout(() => onCloseRef.current?.(), durationMs);
  }, [durationMs]);

  return { phase, requestClose, className: `anim-io anim-io-${phase}` };
}

/**
 * Keep a parent-controlled surface mounted through its exit animation.
 */
export function usePresence(open: boolean, durationMs = MOTION_MS) {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<MotionPhase>(open ? 'enter' : 'exit');

  useEffect(() => {
    if (open) {
      setMounted(true);
      setPhase('enter');
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase('open'));
      });
      return () => cancelAnimationFrame(id);
    }
    setPhase('exit');
    const t = window.setTimeout(() => setMounted(false), durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs]);

  return {
    mounted,
    visible: phase === 'open',
    phase,
    className: `anim-io anim-io-${phase}`,
  };
}
