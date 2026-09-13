import { Sparkles } from 'lucide-react';

interface Props {
  size?: number;
  className?: string;
  strokeWidth?: number;
  title?: string;
}

export function OrbitIcon({ size = 18, className, strokeWidth = 2, title }: Props) {
  return (
    <Sparkles
      size={size}
      strokeWidth={strokeWidth}
      className={['orbit-mark', className].filter(Boolean).join(' ')}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    />
  );
}
