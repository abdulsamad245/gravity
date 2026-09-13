import type { LucideIcon } from 'lucide-react';
import { ArrowUp, CalendarRange, Columns3, Lightbulb, Mic, RefreshCw, Workflow } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CloseButton } from '../../shared/components/CloseButton';
import { dialogAlert } from '../../shared/components/DialogHost';
import { EmojiPicker } from '../../shared/components/EmojiPicker';
import { OrbitIcon } from '../../shared/components/OrbitIcon';
import { TemplatesIcon } from '../../shared/components/TemplatesIcon';
import { Tooltip } from '../../shared/components/Tooltip';
import { ASSISTANT_NAME } from '../../shared/constants/app.constants';
import { ORBIT_MAX_FILE_BYTES } from '../../shared/constants/media.constants';
import { ORBIT_MAX_PROMPT_CHARS } from '../../shared/constants/orbit.constants';
import { SURFACE_MOTION_MS } from '../../shared/constants/motion.constants';
import { useOpenTransition } from '../../shared/hooks/useOpenTransition';
import { useTypedPlaceholder } from '../../shared/hooks/useTypedPlaceholder';
import { insertIntoTextarea } from '../../shared/utils/textarea-insert';
import { formatOrbitBytes } from '../sidekick/orbit-attachments';
import { clampOrbitPrompt, orbitPromptLimitMessage } from '../sidekick/orbit-limits';
import { ORBIT_PLACEHOLDER_EXAMPLES } from '../sidekick/orbit-placeholder-examples';
import { useAudioRecorder } from '../media/useAudioRecorder';
import { VoiceNoteChip } from '../media/VoiceNoteChip';
import { VoiceRecordStrip } from '../media/VoiceRecordStrip';

interface Props {
  userName: string;
  onClose: () => void;
  onOpenTemplates: () => void;
  /** Opens Orbit and optionally auto-sends a seed prompt / voice note. */
  onOpenOrbit: (seed?: string, voice?: { dataUrl: string; seconds: number }) => void;
}

const PROMPTS: { label: string; icon: LucideIcon; tone: string; command: string }[] = [
  {
    label: 'Brainstorm ideas',
    icon: Lightbulb,
    tone: 'amber',
    command: 'Create a brainstorm sticky ring on the canvas now',
  },
  {
    label: 'Create sequence diagram',
    icon: Workflow,
    tone: 'blue',
    command:
      'Create a sequence diagram on the canvas now with labeled steps and connectors between them',
  },
  {
    label: 'Plan sprint timeline',
    icon: CalendarRange,
    tone: 'teal',
    command:
      'Create a sprint timeline on the canvas now with milestone frames and sticky tasks under each',
  },
  {
    label: 'Retro board',
    icon: RefreshCw,
    tone: 'rose',
    command: 'Create a retro board on the canvas now (went well / improve / actions)',
  },
  {
    label: 'Kanban for a team',
    icon: Columns3,
    tone: 'violet',
    command: 'Create a kanban board for a team on the canvas now',
  },
];

/** Empty-board start chat — Quick starts and Send run Orbit immediately. */
export function BoardStartModal({ userName, onClose, onOpenTemplates, onOpenOrbit }: Props) {
  const { requestClose, className } = useOpenTransition(onClose, SURFACE_MOTION_MS);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [voice, setVoice] = useState<{ src: string; seconds: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !!text.trim() || !!voice;

  const recorder = useAudioRecorder((dataUrl, seconds) => {
    const approxBytes = Math.round(dataUrl.length * 0.75);
    if (approxBytes > ORBIT_MAX_FILE_BYTES) {
      dialogAlert(
        `Voice note is too large (max ${formatOrbitBytes(ORBIT_MAX_FILE_BYTES)}). Try a shorter recording.`,
      );
      return;
    }
    setVoice({ src: dataUrl, seconds });
  });

  const typedPlaceholder = useTypedPlaceholder(ORBIT_PLACEHOLDER_EXAMPLES, {
    active: !text.trim() && !focused && !recorder.recording,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  const runOrbit = (seed?: string, voiceNote?: { dataUrl: string; seconds: number }) => {
    if (recorder.recording) recorder.stop();
    requestClose();
    window.setTimeout(() => onOpenOrbit(seed, voiceNote), SURFACE_MOTION_MS);
  };

  const submit = () => {
    const q = clampOrbitPrompt(text.trim());
    if (!q && !voice) return;
    runOrbit(
      q || undefined,
      voice ? { dataUrl: voice.src, seconds: voice.seconds } : undefined,
    );
  };

  const promptLimitHint = orbitPromptLimitMessage(text);

  return (
    <div className={`modal-backdrop ${className}`} role="presentation">
      <div
        className="board-start panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-start-title"
      >
        <div className="board-start-header">
          <h2 id="board-start-title">Hey {userName}, what are we working on today?</h2>
          <CloseButton onClick={requestClose} />
        </div>

        {voice && !recorder.recording && (
          <VoiceNoteChip
            src={voice.src}
            durationSec={voice.seconds}
            onRemove={() => setVoice(null)}
          />
        )}

        <div className="board-start-composer">
          {recorder.recording ? (
            <VoiceRecordStrip
              className="voice-record-in-composer"
              seconds={recorder.seconds}
              levels={recorder.levels}
              onStop={() => recorder.stop()}
            />
          ) : (
            <textarea
              ref={inputRef}
              className="input board-start-textarea"
              placeholder={typedPlaceholder}
              value={text}
              maxLength={ORBIT_MAX_PROMPT_CHARS}
              onChange={(e) => setText(clampOrbitPrompt(e.target.value))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label={`Ask ${ASSISTANT_NAME}`}
              aria-describedby={promptLimitHint ? 'board-start-prompt-limit' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          )}
          {promptLimitHint && (
            <p id="board-start-prompt-limit" className="sidekick-attach-error soft" role="status">
              {promptLimitHint}
            </p>
          )}
          <div className="board-start-toolbar">
            <div className="board-start-toolbar-left">
              <EmojiPicker
                side="top"
                label="Emoji"
                onPick={(emoji) => {
                  const el = inputRef.current;
                  if (!el) return;
                  setText(insertIntoTextarea(el, emoji, ORBIT_MAX_PROMPT_CHARS));
                  el.focus();
                }}
              />
              <Tooltip side="top" label={recorder.recording ? 'Stop recording' : 'Record voice note'}>
                <button
                  type="button"
                  className={`sidekick-tool-btn${recorder.recording ? ' recording' : ''}`}
                  aria-label={recorder.recording ? 'Stop recording' : 'Record voice note'}
                  onClick={() => {
                    if (recorder.recording) recorder.stop();
                    else
                      void recorder.start().catch(() =>
                        dialogAlert('Microphone access is needed to record a voice note.'),
                      );
                  }}
                >
                  <Mic size={16} strokeWidth={2} />
                </button>
              </Tooltip>
            </div>
            <Tooltip
              side="top"
              align="end"
              label={canSend ? `Send to ${ASSISTANT_NAME}` : 'Add a message or voice note'}
            >
              <button
                type="button"
                className={`sidekick-send-icon ${canSend ? 'ready' : ''}`}
                aria-label={`Send to ${ASSISTANT_NAME}`}
                disabled={!canSend || recorder.recording}
                onClick={submit}
              >
                <ArrowUp size={18} strokeWidth={2.25} aria-hidden />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="board-start-prompts" role="group" aria-label="Quick starts">
          <p className="board-start-prompts-label">Quick starts</p>
          <div className="board-start-prompt-grid">
            {PROMPTS.map(({ label, icon: Icon, tone, command }) => (
              <button
                key={label}
                type="button"
                className={`board-start-prompt tone-${tone}`}
                onClick={() => runOrbit(command)}
              >
                <span className="board-start-prompt-icon" aria-hidden>
                  <Icon size={13} strokeWidth={2} />
                </span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="board-start-footer">
          <button
            type="button"
            className="btn"
            onClick={() => {
              requestClose();
              window.setTimeout(onOpenTemplates, SURFACE_MOTION_MS);
            }}
          >
            <TemplatesIcon size={16} /> Explore Templates
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={() =>
              runOrbit(
                text.trim() || undefined,
                voice ? { dataUrl: voice.src, seconds: voice.seconds } : undefined,
              )
            }
          >
            <OrbitIcon size={16} /> Open {ASSISTANT_NAME}
          </button>
        </div>
      </div>
    </div>
  );
}
