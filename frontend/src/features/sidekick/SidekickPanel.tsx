import {
  ArrowUp,
  BoxSelect,
  ChevronDown,
  FileText,
  History,
  LayoutTemplate,
  LocateFixed,
  Mic,
  Paperclip,
  Square,
  SquarePen,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  askOrbit,
  askOrbitStream,
  describeOrbitImage,
  transcribeOrbitAudio,
  type OrbitOp,
} from '../../shared/api/client';
import { CloseButton } from '../../shared/components/CloseButton';
import { dialogAlert } from '../../shared/components/DialogHost';
import { EmojiPicker } from '../../shared/components/EmojiPicker';
import { OrbitIcon } from '../../shared/components/OrbitIcon';
import { Tooltip } from '../../shared/components/Tooltip';
import { APP_NAME, ASSISTANT_NAME } from '../../shared/constants/app.constants';
import {
  isOrbitAudioType,
  ORBIT_ACCEPT,
  ORBIT_MAX_ATTACHMENTS,
  ORBIT_MAX_FILE_BYTES,
} from '../../shared/constants/media.constants';
import {
  ORBIT_MAX_BOARD_ITEMS,
  ORBIT_MAX_HISTORY_CHARS,
  ORBIT_MAX_HISTORY_MESSAGES,
  ORBIT_MAX_PROMPT_CHARS,
} from '../../shared/constants/orbit.constants';
import { SURFACE_MOTION_MS } from '../../shared/constants/motion.constants';
import { usePresence } from '../../shared/hooks/useOpenTransition';
import { useTypedPlaceholder } from '../../shared/hooks/useTypedPlaceholder';
import type { CanvasObject } from '../../shared/types';
import { insertIntoTextarea } from '../../shared/utils/textarea-insert';
import { useUiStore } from '../../stores/ui.store';
import { screenToWorld, useViewStore } from '../../stores/view.store';
import type { RoomConnection } from '../collaboration/RoomConnection';
import {
  showOrbitChromeGuide,
  type OrbitChromeGuide,
} from '../tour/chrome-spotlight';
import { useAudioRecorder } from '../media/useAudioRecorder';
import { VoiceNoteChip } from '../media/VoiceNoteChip';
import { VoiceRecordStrip } from '../media/VoiceRecordStrip';
import {
  formatOrbitBytes,
  prepareOrbitAttachments,
  type OrbitAttachment,
} from './orbit-attachments';
import { clampOrbitPrompt, isOrbitPromptAtLimit, orbitPromptLimitMessage } from './orbit-limits';
import {
  deleteOrbitChat,
  formatOrbitChatTime,
  listOrbitChatSessions,
  loadActiveOrbitChat,
  persistOrbitChat,
  startNewOrbitChat,
  switchOrbitChat,
  type OrbitChatSession,
} from './orbit-chat-storage';
import {
  expandAffirmativeFollowUp,
  isShortAffirmation,
  resolveAffirmationLocalIntent,
  resolveLocalOrbitIntent,
} from './orbit-intent';
import { applyOrbitOps, summarizeOrbitOps, type OrbitOp as ApplyOrbitOp } from './orbit-ops';
import {
  formatOrbitSelectionNote,
  splitOrbitUserText,
  stripOrbitContextAppendix,
} from './orbit-context-format';
import { ORBIT_PLACEHOLDER_EXAMPLES } from './orbit-placeholder-examples';

export type OrbitSeedVoice = {
  dataUrl: string;
  seconds: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  userName?: string;
  roomId?: string;
  onUseTemplate?: () => void;
  initialPrompt?: string;
  /** Voice note from board-start; transcribed then sent like a mic attachment. */
  initialVoice?: OrbitSeedVoice | null;
  onInitialVoiceConsumed?: () => void;
  objects: Record<string, CanvasObject>;
  /** When set, Orbit can create or edit board objects. */
  conn?: RoomConnection;
}

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  attachments?: OrbitAttachment[];
  /** Waiting for first token */
  thinking?: boolean;
  /** Tokens still arriving */
  streaming?: boolean;
  /** Spotlight a toolbar / chrome control (product how-to answers). */
  guide?: OrbitChromeGuide;
}

const STARTERS: { title: string; prompt: string; blurb: string }[] = [
  {
    title: 'Icebreaker',
    prompt: 'Build an icebreaker board for 5 people on the canvas now',
    blurb: 'Warm-up stickies on the board',
  },
  {
    title: 'Retro',
    prompt: 'Create a retro board (went well / improve / actions) on the canvas now',
    blurb: 'Three columns placed for you',
  },
  {
    title: 'Kanban',
    prompt: 'Create a kanban board for a sprint on the canvas now',
    blurb: 'To do / Doing / Done frames',
  },
  {
    title: 'Flowchart',
    prompt: 'Build a simple flowchart diagram on the canvas now with Start, Work, Decision, Done',
    blurb: 'Shapes and connectors',
  },
  {
    title: 'Cluster',
    prompt: 'Cluster the stickies on the board into themes and summarize the takeaways',
    blurb: 'Group ideas and synthesize',
  },
];

function contextLabelFor(obj: CanvasObject): string {
  const t = obj.type;
  const text = (obj.text ?? '').trim().replace(/\s+/g, ' ');
  if (text) return text.length > 28 ? `${text.slice(0, 28)}…` : text;
  const pretty =
    t === 'ellipse'
      ? 'Oval'
      : t === 'rect'
        ? 'Rectangle'
        : t === 'sticky'
          ? 'Sticky'
          : t.charAt(0).toUpperCase() + t.slice(1);
  return pretty;
}

export function SidekickPanel({
  open,
  onClose,
  userName,
  roomId,
  onUseTemplate,
  initialPrompt,
  initialVoice,
  onInitialVoiceConsumed,
  objects,
  conn,
}: Props) {
  const { mounted, className } = usePresence(open, SURFACE_MOTION_MS);
  const selectedIds = useUiStore((s) => s.selectedIds);
  const toggleSelectedId = useUiStore((s) => s.toggleSelectedId);
  const setSelectedIds = useUiStore((s) => s.setSelectedIds);
  const [prompt, setPrompt] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [attachments, setAttachments] = useState<OrbitAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<OrbitChatSession[]>([]);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [boardNote, setBoardNote] = useState<string | null>(null);
  /** Objects Orbit last created/updated — used for "them" / "add labels" follow-ups. */
  const [recentOrbitItems, setRecentOrbitItems] = useState<
    Array<{
      id: string;
      type: string;
      label: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      text?: string;
      fill?: string;
    }>
  >([]);
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const promptRef = useRef(prompt);
  const attachmentsRef = useRef(attachments);
  const busyRef = useRef(busy);
  const abortRef = useRef<AbortController | null>(null);
  promptRef.current = prompt;
  attachmentsRef.current = attachments;
  busyRef.current = busy;

  const stopAsk = useCallback(() => {
    abortRef.current?.abort();
  }, []);
  const userId = conn?.identity.id;
  const storageReady = Boolean(roomId && userId);

  const contextItems = useMemo(
    () =>
      selectedIds
        .map((id) => objects[id])
        .filter((o): o is CanvasObject => !!o)
        .map((o) => ({
          id: o.id,
          label: contextLabelFor(o),
          type: o.type,
          fill: o.fill,
          x: Math.round(o.x),
          y: Math.round(o.y),
          width: Math.round(o.width),
          height: Math.round(o.height),
          text: (o.text ?? '').slice(0, 200),
        })),
    [selectedIds, objects],
  );

  const historyForApi = useCallback(
    (prior: Msg[]) =>
      prior
        .filter((m) => m.text.trim() && !m.thinking)
        .slice(-ORBIT_MAX_HISTORY_MESSAGES)
        .map((m) => ({
          role: m.role,
          text: stripOrbitContextAppendix(m.text).slice(0, ORBIT_MAX_HISTORY_CHARS),
        }))
        .filter((m) => m.text.length > 0),
    [],
  );

  const applyBoardOps = useCallback(
    (ops: OrbitOp[] | undefined) => {
      if (!conn || !ops?.length) {
        setBoardNote(null);
        return;
      }
      if (!conn.canEdit()) {
        setBoardNote('You need edit access to apply Orbit board changes.');
        return;
      }
      const view = useViewStore.getState();
      const origin = screenToWorld(view, window.innerWidth / 2, window.innerHeight / 2);
      const result = applyOrbitOps(conn, ops as ApplyOrbitOp[], origin);
      setBoardNote(summarizeOrbitOps(result));

      const touched = [...result.createdIds, ...result.updatedIds];
      if (touched.length) {
        const snapshot = touched
          .map((id) => conn.getObject(id))
          .filter((o): o is CanvasObject => !!o && o.type !== 'connector')
          .map((o) => ({
            id: o.id,
            type: o.type,
            label: contextLabelFor(o),
            x: Math.round(o.x),
            y: Math.round(o.y),
            width: Math.round(o.width),
            height: Math.round(o.height),
            text: (o.text ?? '').slice(0, 200),
            fill: o.fill,
          }));
        if (snapshot.length) {
          setRecentOrbitItems(snapshot);
          setSelectedIds(snapshot.map((s) => s.id));
        }
      }
    },
    [conn, setSelectedIds],
  );

  const hasThread = messages.length > 0;
  const refreshSessionList = useCallback(() => {
    setSessions(listOrbitChatSessions(roomId, userId));
  }, [roomId, userId]);

  // Restore this tab's Orbit thread for room + identity (never mix users/rooms).
  useEffect(() => {
    setChatHydrated(false);
    if (!storageReady) {
      setSessionId(null);
      setMessages([]);
      setSessions([]);
      return;
    }
    const loaded = loadActiveOrbitChat(roomId, userId);
    setSessionId(loaded.sessionId);
    setMessages(
      loaded.messages.map((m) => ({
        role: m.role,
        text: m.text,
        attachments: m.attachmentNames?.map((name, i) => ({
          id: `restored-${i}`,
          name,
          type: 'application/octet-stream',
          size: 0,
        })),
      })),
    );
    setSessions(listOrbitChatSessions(roomId, userId));
    seeded.current = false;
    setChatHydrated(true);
  }, [roomId, userId, storageReady]);

  // Persist when a turn finishes (skip mid-stream / pre-hydrate).
  useEffect(() => {
    if (!storageReady || !chatHydrated) return;
    if (messages.some((m) => m.thinking || m.streaming)) return;
    const id = persistOrbitChat(roomId, userId, sessionId, messages);
    if (id && id !== sessionId) setSessionId(id);
    refreshSessionList();
  }, [messages, roomId, userId, sessionId, storageReady, chatHydrated, refreshSessionList]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!historyOpen) return;
    refreshSessionList();
    const onDown = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [historyOpen, refreshSessionList]);

  const resetChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    const nextId = startNewOrbitChat(roomId, userId, sessionId, messages);
    setSessionId(nextId);
    setMessages([]);
    setPrompt('');
    setAttachments([]);
    setAttachError(null);
    setBoardNote(null);
    setRecentOrbitItems([]);
    setMenuOpen(false);
    setHistoryOpen(false);
    seeded.current = false;
    refreshSessionList();
    composerRef.current?.focus();
  };

  const openSession = (id: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    if (storageReady) {
      persistOrbitChat(roomId, userId, sessionId, messages);
    }
    const restored = switchOrbitChat(roomId, userId, id);
    setSessionId(id);
    setMessages(
      restored.map((m) => ({
        role: m.role,
        text: m.text,
        attachments: m.attachmentNames?.map((name, i) => ({
          id: `restored-${id}-${i}`,
          name,
          type: 'application/octet-stream',
          size: 0,
        })),
      })),
    );
    setHistoryOpen(false);
    setBoardNote(null);
    setRecentOrbitItems([]);
    seeded.current = true;
  };

  const removeSession = (id: string) => {
    const result = deleteOrbitChat(roomId, userId, id);
    setSessionId(result.activeId);
    setMessages(
      result.messages.map((m) => ({
        role: m.role,
        text: m.text,
      })),
    );
    refreshSessionList();
    if (!result.activeId) seeded.current = false;
  };

  const addFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      setAttachError(null);
      const alreadyExtracted = attachments.reduce(
        (sum, f) => sum + (f.extractedText?.length ?? 0),
        0,
      );
      const { ok, errors } = await prepareOrbitAttachments(
        files,
        attachments.length,
        alreadyExtracted,
      );
      if (ok.length) setAttachments((prev) => [...prev, ...ok].slice(0, ORBIT_MAX_ATTACHMENTS));
      if (errors.length) setAttachError(errors[0].message);
    },
    [attachments],
  );

  const recorder = useAudioRecorder((dataUrl, seconds) => {
    if (attachments.length >= ORBIT_MAX_ATTACHMENTS) {
      setAttachError(`You can attach up to ${ORBIT_MAX_ATTACHMENTS} files.`);
      return;
    }
    const approxBytes = Math.round(dataUrl.length * 0.75);
    if (approxBytes > ORBIT_MAX_FILE_BYTES) {
      setAttachError(
        `Voice note is too large (max ${formatOrbitBytes(ORBIT_MAX_FILE_BYTES)}). Try a shorter recording.`,
      );
      return;
    }
    const secs = Math.max(1, Math.round(seconds));
    setAttachError(null);
    setAttachments((prev) =>
      [
        ...prev,
        {
          id: `voice-${Date.now()}`,
          name: `Voice note · ${secs}s`,
          type: 'audio/webm',
          size: approxBytes,
          dataUrl,
          audioDuration: seconds,
        },
      ].slice(0, ORBIT_MAX_ATTACHMENTS),
    );
  });

  const typedPlaceholder = useTypedPlaceholder(ORBIT_PLACEHOLDER_EXAMPLES, {
    active: open && !prompt.trim() && !composerFocused && !recorder.recording && !busy,
  });

  const ask = useCallback(
    async (raw?: string, extraFiles?: OrbitAttachment[]) => {
      // Read latest composer state (avoids stale closures after voice attach).
      const q = clampOrbitPrompt((raw ?? promptRef.current).trim());
      const files = [...attachmentsRef.current, ...(extraFiles ?? [])].slice(0, ORBIT_MAX_ATTACHMENTS);
      if ((!q && !files.length) || busyRef.current) return;
      if (recorder.recording) recorder.stop();

      const ctx = contextItems;
      const audioCount = files.filter((f) => isOrbitAudioType(f.type, f.name)).length;
      let userText =
        q ||
        (audioCount
          ? `Voice note${audioCount > 1 ? 's' : ''} attached`
          : files.length
            ? `Attached ${files.length} file${files.length === 1 ? '' : 's'}`
            : '');
      if (ctx.length) {
        // Plain-language note (also what users can type themselves). Structured
        // `context` still goes to the API separately for precise edits.
        userText += `\n\n${formatOrbitSelectionNote(ctx)}`;
      }

      setPrompt('');
      setAttachments([]);
      setAttachError(null);
      setBoardNote(null);
      setMenuOpen(false);

      // Capture history before appending this turn.
      let prior: Msg[] = [];
      setMessages((m) => {
        prior = m;
        return [
          ...m,
          { role: 'user', text: userText, attachments: files.length ? files : undefined },
          { role: 'assistant', text: '', thinking: true, streaming: true },
        ];
      });

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const { signal } = ac;
      setBusy(true);

      const isAborted = () => signal.aborted;
      const isAbortErr = (err: unknown) =>
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError');

      // Voice → Whisper transcript; images → vision description; then chat stays text-only.
      let enrichedFiles = files;
      let spoken = q;
      const needsMediaUnderstand = files.some(
        (f) =>
          !!f.dataUrl &&
          !f.extractedText &&
          (isOrbitAudioType(f.type, f.name) || f.type.startsWith('image/')),
      );
      if (needsMediaUnderstand) {
        try {
          enrichedFiles = await Promise.all(
            files.map(async (f) => {
              if (!f.dataUrl || f.extractedText) return f;
              if (isOrbitAudioType(f.type, f.name)) {
                const text = await transcribeOrbitAudio(f.dataUrl, f.type, signal);
                return { ...f, extractedText: text };
              }
              if (f.type.startsWith('image/')) {
                const text = await describeOrbitImage(f.dataUrl, f.type, signal);
                return { ...f, extractedText: text };
              }
              return f;
            }),
          );
          const transcripts = enrichedFiles
            .filter((f) => isOrbitAudioType(f.type, f.name) && f.extractedText)
            .map((f) => f.extractedText!.trim())
            .filter(Boolean);
          const imageCount = enrichedFiles.filter(
            (f) => f.type.startsWith('image/') && f.extractedText,
          ).length;
          if (!spoken && transcripts.length) {
            spoken = clampOrbitPrompt(transcripts.join('\n'));
            const selectionNote = ctx.length ? `\n\n${formatOrbitSelectionNote(ctx)}` : '';
            const display = `${spoken}${selectionNote}`;
            setMessages((m) => {
              const next = [...m];
              const userIdx = next.length - 2;
              const userMsg = next[userIdx];
              if (userMsg?.role === 'user') {
                next[userIdx] = { ...userMsg, text: display, attachments: enrichedFiles };
              }
              return next;
            });
          } else if (!spoken && imageCount) {
            spoken = clampOrbitPrompt(
              imageCount > 1
                ? 'I attached images. Read them carefully and respond based on what they show. If they contain a diagram, list, sketch, or request, help with that on the canvas.'
                : 'I attached an image. Read it carefully and respond based on what it shows. If it contains a diagram, list, sketch, or request, help with that on the canvas.',
            );
            setMessages((m) => {
              const next = [...m];
              const userIdx = next.length - 2;
              const userMsg = next[userIdx];
              if (userMsg?.role === 'user') {
                next[userIdx] = { ...userMsg, attachments: enrichedFiles };
              }
              return next;
            });
          }
        } catch (err) {
          if (isAbortErr(err) || isAborted()) {
            // Handled below via finishStopped path after busy clear.
          } else {
            const raw =
              err instanceof Error && err.message
                ? err.message
                : 'I could not read that attachment. Try again, or type what you need.';
            // Prefer a short human line; hide low-level data-URL parser wording.
            const message = /base64 (audio|image )?data URL/i.test(raw)
              ? 'I could not read that voice note or image. Try recording again, or type what you need.'
              : raw;
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = {
                  ...last,
                  text: message,
                  thinking: false,
                  streaming: false,
                };
              }
              return next;
            });
            if (abortRef.current === ac) abortRef.current = null;
            setBusy(false);
            return;
          }
        }
        if (isAborted()) {
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                text: last.text.trim() || 'Stopped.',
                thinking: false,
                streaming: false,
              };
            }
            return next;
          });
          if (abortRef.current === ac) abortRef.current = null;
          setBusy(false);
          return;
        }
      }

      const historyTurns = historyForApi(prior);
      // Bare "yes"/"ok" → continue the last Orbit offer (keeps multi-turn context).
      const promptForModel = clampOrbitPrompt(expandAffirmativeFollowUp(spoken, historyTurns));
      const historyBlob = [...historyTurns.map((h) => h.text), promptForModel].join('\n');
      const local = isShortAffirmation(spoken)
        ? resolveAffirmationLocalIntent(spoken, historyTurns)
        : resolveLocalOrbitIntent(
            spoken || q,
            ctx.map((c) => ({ id: c.id, type: c.type, label: c.label, fill: c.fill, text: c.text })),
            recentOrbitItems,
            historyBlob,
          );

      const patchAssistant = (patch: Partial<Msg>) => {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (!last || last.role !== 'assistant') return m;
          next[next.length - 1] = { ...last, ...patch };
          return next;
        });
      };

      const finishStopped = () => {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (!last || last.role !== 'assistant') return m;
          const kept = last.text.trim();
          next[next.length - 1] = {
            ...last,
            text: kept || 'Stopped.',
            thinking: false,
            streaming: false,
          };
          return next;
        });
      };

      if (local) {
        // Selection/recent-scoped edits (color/rename/delete/labels) — act immediately.
        await new Promise<void>((resolve) => {
          const t = window.setTimeout(resolve, 180);
          signal.addEventListener(
            'abort',
            () => {
              window.clearTimeout(t);
              resolve();
            },
            { once: true },
          );
        });
        if (isAborted()) {
          finishStopped();
        } else {
          patchAssistant({
            text: local.reply,
            thinking: false,
            streaming: false,
            guide: local.guide,
          });
          if (local.ops.length) applyBoardOps(local.ops);
          else setBoardNote(null);
          // Do not auto-scrim the board. User opts in via the Show me button.
        }
        if (abortRef.current === ac) abortRef.current = null;
        setBusy(false);
        return;
      }

      // Skip whole-board dump on bare "yes"/"ok" so stickies do not hijack the follow-up.
      const boardItems = isShortAffirmation(spoken)
        ? []
        : Object.values(objects)
            .filter((object) => object.type === 'sticky' || object.type === 'text' || object.type === 'frame')
            .slice(0, ORBIT_MAX_BOARD_ITEMS)
            .map((object) => ({
              id: object.id,
              type: object.type,
              label: contextLabelFor(object),
              x: object.x,
              y: object.y,
              width: object.width,
              height: object.height,
              text: (object.text ?? '').slice(0, 500),
              fill: object.fill,
            }));

      const payload = {
        prompt: promptForModel,
        app: APP_NAME,
        roomId,
        history: historyTurns,
        recent: recentOrbitItems,
        board: boardItems,
        context: ctx.map((c) => ({
          id: c.id,
          type: c.type,
          label: c.label,
          x: c.x,
          y: c.y,
          width: c.width,
          height: c.height,
          text: c.text,
          fill: c.fill,
        })),
        // Meta + transcript / document text (never raw file bytes / data URLs).
        attachments: enrichedFiles.slice(0, ORBIT_MAX_ATTACHMENTS).map((f) => ({
          name: f.name.slice(0, 180),
          type: f.type,
          size: Math.min(f.size, ORBIT_MAX_FILE_BYTES),
          ...(f.extractedText ? { extractedText: f.extractedText } : {}),
        })),
      };

      const finishUnavailable = (message?: string) => {
        patchAssistant({
          text:
            message ||
            `${ASSISTANT_NAME} is unavailable right now. Try again in a moment, or open Templates for a starter layout.`,
          thinking: false,
          streaming: false,
        });
      };

      try {
        let gotDelta = false;
        let failed = false;
        let appliedOps = false;
        await askOrbitStream(
          payload,
          (event) => {
            if (isAborted()) return;
            if (event.type === 'status' && event.status === 'thinking') {
              patchAssistant({ thinking: true, streaming: true });
              return;
            }
            if (event.type === 'delta') {
              gotDelta = true;
              setMessages((m) => {
                const next = [...m];
                const last = next[next.length - 1];
                if (!last || last.role !== 'assistant') return m;
                next[next.length - 1] = {
                  ...last,
                  text: last.text + event.text,
                  thinking: false,
                  streaming: true,
                };
                return next;
              });
              return;
            }
            if (event.type === 'error') {
              failed = true;
              if (gotDelta) {
                patchAssistant({ thinking: false, streaming: false });
              } else {
                finishUnavailable(event.message);
              }
              return;
            }
            if (event.type === 'done') {
              if (event.reply) patchAssistant({ text: event.reply, thinking: false, streaming: false });
              else patchAssistant({ thinking: false, streaming: false });
              if (event.ops?.length) {
                applyBoardOps(event.ops);
                appliedOps = true;
              }
            }
          },
          signal,
        );

        if (isAborted()) {
          finishStopped();
        } else if (!failed) {
          if (!gotDelta && !appliedOps) {
            // Stream ended without tokens — try one-shot fallback.
            const data = await askOrbit(payload, signal);
            if (isAborted()) finishStopped();
            else {
              patchAssistant({ text: data.reply, thinking: false, streaming: false });
              applyBoardOps(data.ops);
            }
          } else if (!appliedOps) {
            patchAssistant({ thinking: false, streaming: false });
          }
        }
      } catch (err) {
        if (isAborted() || isAbortErr(err)) {
          finishStopped();
        } else {
          try {
            const data = await askOrbit(payload, signal);
            if (isAborted()) finishStopped();
            else {
              patchAssistant({ text: data.reply, thinking: false, streaming: false });
              applyBoardOps(data.ops);
            }
          } catch (fallbackErr) {
            if (isAborted() || isAbortErr(fallbackErr)) finishStopped();
            else finishUnavailable();
          }
        }
      }

      if (abortRef.current === ac) abortRef.current = null;
      setBusy(false);
    },
    [applyBoardOps, contextItems, historyForApi, objects, recentOrbitItems, recorder, roomId],
  );

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setBusy(false);
      seeded.current = false;
      return;
    }
    if (seeded.current) return;
    if (!initialPrompt && !initialVoice) return;
    seeded.current = true;

    if (initialVoice) {
      const secs = Math.max(1, Math.round(initialVoice.seconds));
      const approxBytes = Math.round(initialVoice.dataUrl.length * 0.75);
      const voiceAtt: OrbitAttachment = {
        id: `voice-seed-${Date.now()}`,
        name: `Voice note · ${secs}s`,
        type: 'audio/webm',
        size: approxBytes,
        dataUrl: initialVoice.dataUrl,
        audioDuration: initialVoice.seconds,
      };
      onInitialVoiceConsumed?.();
      void ask(initialPrompt, [voiceAtt]);
      return;
    }

    void ask(initialPrompt);
  }, [open, initialPrompt, initialVoice, ask, onInitialVoiceConsumed]);

  if (!mounted) return null;

  // Text or any pending media (image / voice / file) — not canvas selection alone.
  const hasComposerPayload = prompt.trim().length > 0 || attachments.length > 0;
  const canSend = !busy && !recorder.recording && hasComposerPayload;
  const promptLimitHint = orbitPromptLimitMessage(prompt);
  const promptAtLimit = isOrbitPromptAtLimit(prompt);

  return (
    <aside className={`sidekick-dock panel ${className}`} aria-label={`${ASSISTANT_NAME} assistant`}>
      <header className="sidekick-head">
        <div className="sidekick-title-wrap" ref={menuRef}>
          <button
            type="button"
            className="sidekick-title-btn"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <OrbitIcon size={18} className="sidekick-orbit-mark" />
            <span>{ASSISTANT_NAME}</span>
            <ChevronDown size={16} strokeWidth={2.25} aria-hidden />
          </button>
          {menuOpen && (
            <div className="sidekick-menu panel" role="menu">
              {STARTERS.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  role="menuitem"
                  className="sidekick-menu-item"
                  disabled={busy}
                  onClick={() => void ask(s.prompt)}
                >
                  {s.title}
                </button>
              ))}
              {onUseTemplate && (
                <button
                  type="button"
                  role="menuitem"
                  className="sidekick-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onUseTemplate();
                  }}
                >
                  Open templates
                </button>
              )}
            </div>
          )}
        </div>
        <div className="sidekick-head-actions">
          <Tooltip label="New chat" side="bottom">
            <button type="button" className="sidekick-icon-btn" aria-label="New chat" onClick={resetChat}>
              <SquarePen size={17} strokeWidth={2} />
            </button>
          </Tooltip>
          <div className="sidekick-history-wrap" ref={historyRef}>
            <Tooltip label="Chat history" side="bottom">
              <button
                type="button"
                className={`sidekick-icon-btn${historyOpen ? ' active' : ''}`}
                aria-label="Chat history"
                aria-expanded={historyOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setMenuOpen(false);
                  setHistoryOpen((v) => !v);
                }}
              >
                <History size={17} strokeWidth={2} />
              </button>
            </Tooltip>
            {historyOpen && (
              <div className="sidekick-history panel" role="menu" aria-label="Orbit chat history">
                <div className="sidekick-history-title">Chat history</div>
                {sessions.filter((s) => s.messages.length > 0 || s.id === sessionId).length === 0 ? (
                  <p className="sidekick-history-empty">No saved chats in this room yet.</p>
                ) : (
                  sessions
                    .filter((s) => s.messages.length > 0 || s.id === sessionId)
                    .map((s) => (
                      <div
                        key={s.id}
                        className={`sidekick-history-row${s.id === sessionId ? ' active' : ''}`}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="sidekick-history-item"
                          onClick={() => openSession(s.id)}
                        >
                          <strong>{s.title || 'New chat'}</strong>
                          <span>{formatOrbitChatTime(s.updatedAt)}</span>
                        </button>
                        <button
                          type="button"
                          className="sidekick-history-delete"
                          aria-label={`Delete ${s.title || 'chat'}`}
                          onClick={() => removeSession(s.id)}
                        >
                          <X size={14} strokeWidth={2.25} />
                        </button>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
          {onUseTemplate && (
            <Tooltip label="Templates" side="bottom">
              <button type="button" className="sidekick-icon-btn" aria-label="Templates" onClick={onUseTemplate}>
                <LayoutTemplate size={17} strokeWidth={2} />
              </button>
            </Tooltip>
          )}
          <Tooltip label={`Close ${ASSISTANT_NAME}`} side="bottom" align="end">
            <CloseButton onClick={onClose} label={`Close ${ASSISTANT_NAME}`} size={17} />
          </Tooltip>
        </div>
      </header>

      <div className="sidekick-messages">
        {!hasThread ? (
          <div className="sidekick-empty">
            <p className="sidekick-empty-lead">
              Hey{userName ? ` ${userName}` : ''}. Write in plain language anytime. Select objects when
              you want a precise edit, or just describe them (for example, the sticky that says
              "Launch").
            </p>
            <div className="sidekick-starter-grid">
              {STARTERS.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  className="sidekick-starter-card"
                  disabled={busy}
                  onClick={() => void ask(s.prompt)}
                >
                  <strong>{s.title}</strong>
                  <span>{s.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const userParts = m.role === 'user' ? splitOrbitUserText(m.text) : null;
            return (
            <div
              key={i}
              className={`sidekick-bubble ${m.role}${m.thinking ? ' thinking' : ''}${m.streaming && m.text ? ' streaming' : ''}`}
              role={m.role === 'assistant' ? 'status' : undefined}
              aria-busy={m.thinking || m.streaming || undefined}
            >
              {m.thinking && !m.text ? (
                <span className="sidekick-thinking" aria-live="polite">
                  Thinking
                  <span className="sidekick-thinking-dots" aria-hidden>
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </span>
              ) : (
                <>
                  <span className="sidekick-bubble-body">
                    {userParts ? (
                      <>
                        {userParts.body || (userParts.using ? null : m.text)}
                        {userParts.using ? (
                          <span className="sidekick-msg-using">{userParts.using}</span>
                        ) : null}
                      </>
                    ) : (
                      m.text
                    )}
                    {m.streaming && m.text ? <span className="sidekick-stream-caret" aria-hidden /> : null}
                  </span>
                  {m.role === 'assistant' && m.guide && !m.thinking && !m.streaming ? (
                    <button
                      type="button"
                      className="sidekick-show-me"
                      onClick={() => void showOrbitChromeGuide(m.guide!)}
                    >
                      <LocateFixed size={14} strokeWidth={2.25} aria-hidden />
                      <span>{m.guide.label}</span>
                    </button>
                  ) : null}
                </>
              )}
              {m.attachments && m.attachments.length > 0 && (
                <div className="sidekick-msg-files">
                  {m.attachments.map((f) =>
                    isOrbitAudioType(f.type, f.name) && f.dataUrl ? (
                      <VoiceNoteChip
                        key={f.id}
                        src={f.dataUrl}
                        durationSec={f.audioDuration}
                        name={f.name}
                        compact
                      />
                    ) : (
                      <div key={f.id} className="sidekick-msg-file">
                        {f.type.startsWith('image/') && f.dataUrl ? (
                          <img src={f.dataUrl} alt="" className="sidekick-msg-thumb" />
                        ) : (
                          <FileText size={14} aria-hidden />
                        )}
                        <span>{f.name}</span>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {boardNote && (
        <p className="sidekick-board-note" role="status" aria-live="polite">
          {boardNote}
        </p>
      )}

      <div className="sidekick-footer">
        <div className={`sidekick-context ${contextItems.length ? 'has-selection' : ''}`}>
          <div className="sidekick-context-row">
            <BoxSelect size={15} strokeWidth={2} aria-hidden />
            {contextItems.length === 0 ? (
              <span>Optional: select objects, or just describe them in your message</span>
            ) : (
              <span>
                {contextItems.length} selected · describe freely, or <kbd>Shift</kbd>/<kbd>Ctrl</kbd>{' '}
                click to add more
              </span>
            )}
            {contextItems.length > 0 && (
              <button type="button" className="sidekick-context-clear" onClick={() => setSelectedIds([])}>
                Clear
              </button>
            )}
          </div>
          {contextItems.length > 0 && (
            <ul className="sidekick-context-chips" aria-label="Canvas context">
              {contextItems.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="sidekick-context-chip"
                    title="Remove from selection"
                    onClick={() => toggleSelectedId(c.id)}
                  >
                    <span className="sidekick-context-swatch" style={{ background: c.fill || 'var(--text-dim)' }} />
                    <span>{c.label}</span>
                    <X size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(attachError || promptLimitHint) && (
          <p
            id="orbit-prompt-limit"
            className={`sidekick-attach-error${promptLimitHint && !attachError && !promptAtLimit ? ' soft' : ''}`}
            role="alert"
          >
            {attachError || promptLimitHint}
          </p>
        )}

        <div
          className="sidekick-input-shell sidekick-composer"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => {
            e.preventDefault();
            void addFiles(e.dataTransfer.files);
          }}
        >
          {attachments.length > 0 && (
            <ul className="sidekick-attach-row" aria-label="Attachments">
              {attachments.map((f) => (
                <li key={f.id} className="sidekick-attach-pill">
                  {isOrbitAudioType(f.type, f.name) && f.dataUrl ? (
                    <VoiceNoteChip
                      src={f.dataUrl}
                      durationSec={f.audioDuration}
                      name={f.name}
                      compact
                      onRemove={() => setAttachments((prev) => prev.filter((x) => x.id !== f.id))}
                    />
                  ) : (
                    <>
                      {f.type.startsWith('image/') && f.dataUrl ? (
                        <img src={f.dataUrl} alt="" className="sidekick-attach-thumb" />
                      ) : (
                        <FileText size={14} aria-hidden />
                      )}
                      <span className="sidekick-attach-meta">
                        <strong>{f.name}</strong>
                        <em>{formatOrbitBytes(f.size)}</em>
                      </span>
                      <button
                        type="button"
                        className="sidekick-attach-remove"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== f.id))}
                      >
                        <X size={14} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {recorder.recording ? (
            <VoiceRecordStrip
              className="voice-record-in-composer"
              seconds={recorder.seconds}
              levels={recorder.levels}
              onStop={() => recorder.stop()}
            />
          ) : (
            <textarea
              ref={composerRef}
              className="input sidekick-textarea"
              value={prompt}
              maxLength={ORBIT_MAX_PROMPT_CHARS}
              onChange={(e) => setPrompt(clampOrbitPrompt(e.target.value))}
              placeholder={typedPlaceholder}
              aria-label={`${ASSISTANT_NAME} message`}
              aria-describedby={promptLimitHint ? 'orbit-prompt-limit' : undefined}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void ask();
                }
              }}
              onPaste={(e) => {
                const files = e.clipboardData?.files;
                if (files?.length) {
                  e.preventDefault();
                  void addFiles(files);
                }
              }}
            />
          )}
          <div className="sidekick-toolbar">
            <div className="sidekick-toolbar-left">
              <EmojiPicker
                side="top"
                label="Add emoji"
                onPick={(emoji) => {
                  const el = composerRef.current;
                  if (!el) return;
                  setPrompt(insertIntoTextarea(el, emoji, ORBIT_MAX_PROMPT_CHARS));
                  el.focus();
                }}
              />
              <Tooltip
                side="top"
                align="start"
                label={`Attach (max ${ORBIT_MAX_ATTACHMENTS}, ${formatOrbitBytes(ORBIT_MAX_FILE_BYTES)} each; no video)`}
              >
                <button
                  type="button"
                  className="sidekick-tool-btn"
                  aria-label="Attach file"
                  disabled={busy || recorder.recording || attachments.length >= ORBIT_MAX_ATTACHMENTS}
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip size={16} strokeWidth={2} />
                </button>
              </Tooltip>
              <Tooltip side="top" label={recorder.recording ? 'Stop recording' : 'Record voice note'}>
                <button
                  type="button"
                  className={`sidekick-tool-btn${recorder.recording ? ' recording' : ''}`}
                  aria-label={recorder.recording ? 'Stop recording' : 'Record voice note'}
                  disabled={busy || (!recorder.recording && attachments.length >= ORBIT_MAX_ATTACHMENTS)}
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
              {onUseTemplate && (
                <Tooltip side="top" label="Templates">
                  <button type="button" className="sidekick-tool-btn" aria-label="Templates" onClick={onUseTemplate}>
                    <LayoutTemplate size={16} strokeWidth={2} />
                  </button>
                </Tooltip>
              )}
            </div>
            <Tooltip
              side="top"
              align="end"
              label={busy ? 'Stop' : canSend ? 'Send' : 'Add a message or attachment'}
            >
              <button
                type="button"
                className={`sidekick-send-icon ${busy ? 'stop' : canSend ? 'ready' : ''}`}
                disabled={!busy && !canSend}
                aria-label={busy ? 'Stop' : 'Send'}
                onClick={() => {
                  if (busy) stopAsk();
                  else void ask();
                }}
              >
                {busy ? (
                  <Square size={12} strokeWidth={0} fill="currentColor" aria-hidden />
                ) : (
                  <ArrowUp size={18} strokeWidth={2.25} aria-hidden />
                )}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ORBIT_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </aside>
  );
}
