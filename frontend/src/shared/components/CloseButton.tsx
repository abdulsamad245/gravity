import { X } from 'lucide-react';

interface Props {
  onClick: () => void;
  label?: string;
  size?: number;
  className?: string;
}

/** Dismiss control with an X icon and accessible label. */
export function CloseButton({ onClick, label = 'Close', size = 18, className = '' }: Props) {
  return (
    <button
      type="button"
      className={`btn btn-ghost icon-btn close-icon-btn ${className}`.trim()}
      aria-label={label}
      onClick={onClick}
    >
      <X size={size} strokeWidth={2} aria-hidden />
    </button>
  );
}
