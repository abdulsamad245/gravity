import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_NAME, APP_SUPPORT, APP_TAGLINE } from '../../shared/constants/app.constants';
import { Logo } from '../../shared/components/Logo';
import { ThemeSwitcher } from '../../shared/components/ThemeSwitcher';
import { UsernameField } from '../../shared/components/UsernameField';
import { upsertBoard } from '../../shared/utils/boards';
import { loadIdentity, loadLastName, saveIdentity } from '../../shared/utils/identity';
import { allocateUniqueRoomId } from '../../shared/utils/room-id';
import { parseRoomIdFromInput, roomPath } from '../../shared/utils/room-path';

/** No room library on landing — that lives at /rooms. */
export function LandingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState(loadLastName());
  const [joinValue, setJoinValue] = useState('');
  const [error, setError] = useState('');
  const hasSession = !!loadIdentity();

  const requireUsername = (): boolean => {
    if (name.trim().length < 2) {
      setError('Pick a username first (at least 2 characters).');
      return false;
    }
    saveIdentity(name.trim());
    return true;
  };

  const createRoom = () => {
    if (!requireUsername()) return;
    void (async () => {
      const id = await allocateUniqueRoomId();
      upsertBoard(id);
      navigate(roomPath(id));
    })();
  };

  const joinRoom = () => {
    if (!requireUsername()) return;
    const roomId = parseRoomIdFromInput(joinValue);
    if (!roomId || !/^[A-Za-z0-9_-]{4,64}$/.test(roomId)) {
      setError('That does not look like a valid room link or code.');
      return;
    }
    upsertBoard(roomId);
    navigate(roomPath(roomId));
  };

  return (
    <div className="landing surface-field">
      <a className="skip-link" href="#username">
        Skip to username field
      </a>
      <div className="theme-fab">
        <ThemeSwitcher compact />
      </div>
      <div className="landing-card panel">
        <Logo size={44} className="landing-brand" />
        <p className="landing-tagline">{APP_TAGLINE}</p>
        <p className="landing-desc">{APP_SUPPORT}</p>

        <label className="field-label" htmlFor="username">
          Username
        </label>
        <UsernameField
          id="username"
          value={name}
          onChange={(v) => {
            setName(v);
            setError('');
          }}
          onEnter={createRoom}
        />

        <button type="button" className="btn btn-primary" onClick={createRoom}>
          Open a blank room
        </button>

        {hasSession && (
          <Link to="/rooms" className="landing-boards-link">
            Your rooms
          </Link>
        )}

        <div className="landing-divider">or join a room</div>

        <div className="join-row">
          <input
            className="input"
            placeholder="Invite link or room code"
            value={joinValue}
            aria-label="Invite link or room code"
            onChange={(e) => {
              setJoinValue(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          />
          <button type="button" className="btn" onClick={joinRoom}>
            Join
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** In-room prompt when a guest opens a shared link without a tab identity yet. */
export function NamePrompt({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState(loadLastName());
  return (
    <div className="landing surface-field">
      <div className="landing-card panel">
        <Logo size={36} />
        <p className="landing-desc">
          You have been invited to a {APP_NAME} room. Choose a username so others know who you are.
        </p>
        <label className="field-label" htmlFor="join-username">
          Username
        </label>
        <UsernameField
          id="join-username"
          value={name}
          autoFocus
          onChange={setName}
          onEnter={() => name.trim().length >= 2 && onSubmit(name.trim())}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={name.trim().length < 2}
          onClick={() => onSubmit(name.trim())}
        >
          Jump in
        </button>
      </div>
    </div>
  );
}
