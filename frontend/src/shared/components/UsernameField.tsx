import { Dices } from 'lucide-react';
import { generateUsername } from '../utils/username';
import { Tooltip } from './Tooltip';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  onEnter?: () => void;
  placeholder?: string;
}

/** Username input + auto-generate (skips usernames already used on this device). */
export function UsernameField({
  id,
  value,
  onChange,
  autoFocus,
  onEnter,
  placeholder = 'e.g. Ada',
}: Props) {
  return (
    <div className="username-row">
      <input
        id={id}
        className="input"
        placeholder={placeholder}
        value={value}
        maxLength={40}
        autoFocus={autoFocus}
        autoComplete="username"
        aria-label="Username"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter?.();
        }}
      />
      <Tooltip label="Pick a username for me" side="top">
        <button
          type="button"
          className="btn username-generate-btn"
          aria-label="Pick a username for me"
          onClick={() => onChange(generateUsername({ avoid: value }))}
        >
          <Dices size={16} strokeWidth={2.25} aria-hidden />
          Pick for me
        </button>
      </Tooltip>
    </div>
  );
}
