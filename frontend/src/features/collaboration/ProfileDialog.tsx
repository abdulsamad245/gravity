import { ImagePlus, Pipette, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseButton } from '../../shared/components/CloseButton';
import { UsernameField } from '../../shared/components/UsernameField';
import { USER_COLORS } from '../../shared/constants/colors.constants';
import { useOpenTransition } from '../../shared/hooks/useOpenTransition';
import type { Identity } from '../../shared/types';
import { fileToAvatarDataUrl } from '../media/avatar-utils';
import { shouldShowAvatarColorPicker } from './profile-utils';

interface Props {
  identity: Identity;
  onClose: () => void;
  onSave: (next: { name: string; color: string; avatar?: string | null }) => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function normalizeHex(raw: string): string | null {
  const s = raw.trim();
  const m = /^#?([0-9a-fA-F]{6})$/.exec(s);
  if (!m) return null;
  return `#${m[1].toLowerCase()}`;
}

/** Edit guest username, avatar color, and optional photo for this tab. */
export function ProfileDialog({ identity, onClose, onSave }: Props) {
  const { requestClose, className } = useOpenTransition(onClose);
  const [name, setName] = useState(identity.name);
  const [color, setColor] = useState(identity.color);
  const [avatar, setAvatar] = useState<string | undefined>(identity.avatar);
  const [photoError, setPhotoError] = useState('');
  const [error, setError] = useState('');
  const titleId = useId();
  const nameId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const trimmed = name.trim();
  const canSave = trimmed.length >= 2;
  const inPalette = USER_COLORS.some((c) => c.toLowerCase() === color.toLowerCase());

  const pickColor = (next: string) => {
    const hex = normalizeHex(next);
    if (!hex) return;
    setColor(hex);
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [requestClose]);

  const onPickPhoto = async (file: File | null) => {
    setPhotoError('');
    if (!file) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      if (!dataUrl) {
        setPhotoError('Use a PNG, JPEG, WebP, or GIF image.');
        return;
      }
      setAvatar(dataUrl);
    } catch {
      setPhotoError('Could not read that image. Try another file.');
    }
  };

  const submit = () => {
    if (trimmed.length < 2) {
      setError('Username needs at least 2 characters.');
      return;
    }
    onSave({ name: trimmed, color, avatar: avatar ?? null });
    requestClose();
  };

  return createPortal(
    <div
      className={`modal-backdrop profile-backdrop ${className}`}
      role="presentation"
      onClick={requestClose}
    >
      <div
        className="profile-dialog panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="profile-dialog-header">
          <h2 id={titleId}>Your profile</h2>
          <CloseButton onClick={requestClose} />
        </div>

        <div className="profile-preview" aria-hidden>
          <span className="profile-preview-avatar" style={{ background: color }}>
            {avatar ? <img src={avatar} alt="" className="avatar-photo" /> : initials(trimmed || identity.name)}
          </span>
          <span className="profile-preview-name">{trimmed || 'Username'}</span>
        </div>

        <div className="profile-photo-row">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              void onPickPhoto(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn btn-ghost profile-photo-btn"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={16} strokeWidth={2.25} aria-hidden />
            {avatar ? 'Change photo' : 'Upload photo'}
          </button>
          {avatar && (
            <button
              type="button"
              className="btn btn-ghost profile-photo-btn"
              onClick={() => {
                setAvatar(undefined);
                setPhotoError('');
              }}
            >
              <Trash2 size={16} strokeWidth={2.25} aria-hidden />
              Remove
            </button>
          )}
        </div>
        {photoError && (
          <p className="form-error" role="alert">
            {photoError}
          </p>
        )}

        <div className="profile-username">
          <label className="profile-field" htmlFor={nameId}>
            Username
          </label>
          <UsernameField
            id={nameId}
            value={name}
            autoFocus
            onChange={(v) => {
              setName(v);
              setError('');
            }}
            onEnter={submit}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {/* Color only applies to the initials avatar — hide when a photo is set. */}
        {shouldShowAvatarColorPicker(avatar) && (
          <fieldset className="profile-colors">
            <legend>Avatar color</legend>
            <div className="profile-color-grid" role="radiogroup" aria-label="Avatar color">
              {USER_COLORS.map((c) => {
                const selected = c.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`profile-color-swatch cursor-pointer${selected ? ' selected' : ''}`}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                    onClick={() => pickColor(c)}
                  />
                );
              })}
              <label
                className={`profile-color-swatch profile-color-custom cursor-pointer${inPalette ? '' : ' selected'}`}
                style={{ background: inPalette ? 'transparent' : color }}
                title="Custom color"
              >
                <Pipette size={14} strokeWidth={2.25} aria-hidden />
                <input
                  type="color"
                  className="profile-color-native cursor-pointer"
                  value={normalizeHex(color) ?? USER_COLORS[0]}
                  aria-label="Pick a custom color"
                  onChange={(e) => pickColor(e.target.value)}
                />
              </label>
            </div>
          </fieldset>
        )}

        <div className="profile-dialog-actions">
          <button type="button" className="btn" onClick={requestClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={submit}>
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
