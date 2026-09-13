import type Konva from 'konva';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type * as Y from 'yjs';
import { fetchReplayLog } from '../../shared/api/client';
import { OBJECT_ID_LENGTH, ZOOM_MAX, ZOOM_MIN } from '../../shared/constants/canvas.constants';
import { logger } from '../../shared/logging/logger';
import { setSentryContext } from '../../shared/logging/sentry';
import type { Identity } from '../../shared/types';
import { clamp } from '../../shared/utils/geometry';
import { loadIdentity, saveIdentity } from '../../shared/utils/identity';
import { throttle } from '../../shared/utils/throttle';
import { screenToWorld, useViewStore } from '../../stores/view.store';
import { useUiStore } from '../../stores/ui.store';
import { PresenceBar } from '../collaboration/PresenceBar';
import {
  loadRoomSession,
  persistRoomSession,
} from '../collaboration/room-session-storage';
import { RoomConnection } from '../collaboration/RoomConnection';
import { useConnectionStatus, useIsPhysicsHost, useRemoteUsers } from '../collaboration/useAwareness';
import { useRoomChromeReady } from '../collaboration/useRoomChromeReady';
import { BOARD_START_REVEAL_DELAY_MS } from '../../shared/constants/motion.constants';
import { ReactionsOverlay } from '../facilitation/ReactionsOverlay';
import { useComments } from '../collaboration/useComments';
import { useObjects } from '../collaboration/useObjects';
import { useRoomAccess } from '../collaboration/useRoomAccess';
import { sessionVotesForObject, useWorkshopState } from '../collaboration/useWorkshopState';
import { exportJSON, exportPNG, exportSVG } from '../export/exporters';
import { importBoardJSON } from '../export/importers';
import { NamePrompt } from '../landing/LandingPage';
import { fileToImageObject } from '../media/image-utils';
import { usePromoteInlineMedia } from '../media/usePromoteInlineMedia';
import { settleObjects, toggleMagnetRole } from '../physics/physics-actions';
import { Minimap } from '../minimap/Minimap';
import { useBoardGravitySync } from '../physics/useBoardGravitySync';
import { usePhysics } from '../physics/usePhysics';
import { InstallPrompt } from '../pwa/InstallPrompt';
import { parseSessionReplayFile } from '../replay/parse-session-replay';
import { ReplayBar } from '../replay/ReplayBar';
import { ReplayController } from '../replay/ReplayController';
import { ReplayExportHost } from '../replay/ReplayExportHost';
import { nanoid } from 'nanoid';
import { DEFAULTS, DEFAULT_FONT_SIZE } from '../../shared/constants/canvas.constants';
import { shapePaintFromFill, STICKY_COLORS } from '../../shared/constants/colors.constants';
import type { CanvasObject } from '../../shared/types';
import { worldBounds } from '../../shared/utils/geometry';
import { BoardStartModal } from './BoardStartModal';
import { EmbedObjectsOverlay } from './EmbedObjectsOverlay';
import { ImageObjectsOverlay } from './ImageObjectsOverlay';
import { MediaResourceOverlay } from './MediaResourceOverlay';
import { CanvasStage } from './CanvasStage';
import { createCodeObject } from './code-object';
import { CommentsLayer, makeCommentDraft } from './CommentsLayer';
import { ContextMenu, type ContextAction, type ContextMenuState } from './ContextMenu';
import { SelectionToolbar } from './SelectionToolbar';
import { StructuredDataOverlay } from './StructuredDataOverlay';
import { TextEditOverlay } from './TextEditOverlay';
import { Toolbar } from './Toolbar';
import { ZoomControls } from './ZoomControls';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { TemplatesModal } from '../templates/TemplatesModal';
import { BOARD_TEMPLATES } from '../templates/templates';
import { SidekickPanel } from '../sidekick/SidekickPanel';
import { MoveDialog } from './MoveDialog';
import { addMindMapChild, layoutMindMap } from './mind-map';
import { dialogAlert, dialogPrompt } from '../../shared/components/DialogHost';
import { consumePendingTemplate, PENDING_TEMPLATE_KEY } from '../../shared/utils/boards';
import { toUserFacingError } from '../../shared/utils/user-facing-error';
import { PresentationOverlay } from '../presentation/PresentationOverlay';
import { presentationFrames } from '../presentation/presentation.utils';
import { PRODUCT_TOUR_START_DELAY_MS } from '../tour/tour.constants';
import { startProductTour } from '../tour/product-tour';
import { useProductTour } from '../tour/useProductTour';

const CodeEditOverlay = lazy(() =>
  import('./CodeEditOverlay').then((module) => ({ default: module.CodeEditOverlay })),
);

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [identity, setIdentity] = useState<Identity | null>(loadIdentity());

  if (!roomId || !/^[A-Za-z0-9_-]{4,64}$/.test(roomId)) return <Navigate to="/" replace />;
  if (!identity) return <NamePrompt onSubmit={(name) => setIdentity(saveIdentity(name))} />;
  return <ConnectedRoom roomId={roomId} identity={identity} />;
}

/** Owns the RoomConnection lifecycle (created once per room+identity). */
function ConnectedRoom({ roomId, identity }: { roomId: string; identity: Identity }) {
  const [conn, setConn] = useState<RoomConnection | null>(null);

  useEffect(() => {
    const c = new RoomConnection(roomId, identity);
    setSentryContext(roomId, identity.name);
    setConn(c);
    return () => {
      c.destroy();
      setConn(null);
    };
  }, [roomId, identity]);

  if (!conn) return null;
  return <Room conn={conn} />;
}

interface ReplayState {
  controller: ReplayController;
  map: Y.Map<Y.Map<unknown>>;
}

function Room({ conn }: { conn: RoomConnection }) {
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatesNav, setTemplatesNav] = useState('all');
  const [orbitOpen, setOrbitOpen] = useState(
    () => loadRoomSession(conn.roomId, conn.identity.id)?.orbitOpen ?? false,
  );
  const [orbitSeed, setOrbitSeed] = useState<string | undefined>();
  const [orbitSeedVoice, setOrbitSeedVoice] = useState<{ dataUrl: string; seconds: number } | null>(null);
  /** Temporary hide via X/Escape; cleared again once the board has objects. */
  const [boardStartDismissed, setBoardStartDismissed] = useState(false);
  const sessionRestored = useRef(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [focusPulseId, setFocusPulseId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const stageRef = useRef<Konva.Stage | null>(null);
  const toastTimer = useRef<number | null>(null);
  const focusHandled = useRef(false);
  /** Compact chrome for iframe embeds (?embed=1). */
  const embedMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('embed') === '1';
  }, []);
  const fullAppHref = useMemo(() => {
    if (typeof window === 'undefined') return '#';
    const url = new URL(window.location.href);
    url.searchParams.delete('embed');
    return url.toString();
  }, []);

  const objects = useObjects(replay ? replay.map : conn.objects);
  const comments = useComments(conn.comments);
  const remoteUsers = useRemoteUsers(conn);
  const status = useConnectionStatus(conn);
  const isHost = useIsPhysicsHost(conn);
  const access = useRoomAccess(conn);
  const workshop = useWorkshopState(conn);
  const followClientId = useUiStore((s) => s.followClientId);
  const selectedId = useUiStore((s) => s.selectedId);
  const setSelectedId = useUiStore((s) => s.setSelectedId);
  const setCommentDraft = useUiStore((s) => s.setCommentDraft);
  const clipboard = useUiStore((s) => s.clipboard);
  const setClipboard = useUiStore((s) => s.setClipboard);
  const fillColor = useUiStore((s) => s.fillColor);
  const boardGravity = useUiStore((s) => s.boardGravity);
  const canInteract = !replay && access.canEdit && !presenting;
  const chromeReady = useRoomChromeReady(conn);
  const boardStartEligible =
    chromeReady &&
    canInteract &&
    Object.keys(objects).length === 0 &&
    !boardStartDismissed &&
    !templatesOpen &&
    !orbitOpen &&
    !presenting &&
    !embedMode;
  const [boardStartReveal, setBoardStartReveal] = useState(false);

  useEffect(() => {
    if (!boardStartEligible) {
      setBoardStartReveal(false);
      return;
    }
    const timer = window.setTimeout(() => setBoardStartReveal(true), BOARD_START_REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [boardStartEligible]);

  const boardStartVisible = boardStartEligible && boardStartReveal;

  usePromoteInlineMedia(conn, status, objects, !replay && access.canEdit);

  useProductTour({
    enabled: chromeReady && canInteract && !embedMode && !presenting && !replay,
    // Hold the tour while the start chat is pending or open (not only while mounted).
    boardReady: !boardStartEligible,
    blocked: templatesOpen || orbitOpen || moveOpen || !!contextMenu,
  });
  const displayObjects = useMemo(() => {
    if (replay) return objects;
    const next: Record<string, CanvasObject> = {};
    for (const [id, object] of Object.entries(objects)) {
      const hiddenPrivateIdea =
        !!workshop.privateBrainstorm?.active &&
        object.type === 'sticky' &&
        !!object.privateAuthorId &&
        object.privateAuthorId !== conn.identity.id &&
        !object.privateRevealed &&
        (object.privateRoundId == null ||
          object.privateRoundId === workshop.privateBrainstorm.startedAt);
      const sessionVotes = sessionVotesForObject(workshop, id).map((voter) => ({
        ...voter,
        at: workshop.voting?.revealedAt ?? 0,
      }));
      next[id] = {
        ...object,
        ...(hiddenPrivateIdea
          ? { text: 'Private idea', privateHidden: true, locked: true }
          : { privateHidden: false }),
        ...(workshop.voting?.status === 'active'
          ? { votes: [] }
          : workshop.voting?.status === 'revealed'
            ? { votes: sessionVotes }
            : {}),
      };
    }
    return next;
  }, [conn.identity.id, objects, replay, workshop]);
  const frames = useMemo(() => presentationFrames(displayObjects), [displayObjects]);

  useEffect(() => {
    if (selectedId && displayObjects[selectedId]?.privateHidden) setSelectedId(null);
  }, [displayObjects, selectedId, setSelectedId]);

  usePhysics(conn, isHost, canInteract, boardGravity);
  useBoardGravitySync(conn);
  useKeyboardShortcuts(conn, canInteract && !editingId);

  // Empty board → show AI start chat. If the user dismissed it, reopen after
  // the board has content again and is later cleared.
  useEffect(() => {
    if (Object.keys(objects).length > 0) setBoardStartDismissed(false);
  }, [objects]);

  // Boards dashboard can seed a template onto a brand-new room.
  useEffect(() => {
    let done = false;
    const apply = () => {
      if (done) return;
      if (Object.keys(conn.getAllObjects()).length > 0) {
        done = true;
        consumePendingTemplate();
        return;
      }
      const tid = sessionStorage.getItem(PENDING_TEMPLATE_KEY);
      if (!tid) return;
      const t = BOARD_TEMPLATES.find((x) => x.id === tid);
      if (!t) {
        consumePendingTemplate();
        return;
      }
      done = true;
      consumePendingTemplate();
      for (const obj of t.build(conn.identity.id)) conn.addObject(obj);
    };
    conn.persistence.once('synced', apply);
    const t = window.setTimeout(apply, 400);
    return () => {
      window.clearTimeout(t);
      conn.persistence.off('synced', apply);
    };
  }, [conn]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 1600);
  }, []);

  const copyObjectLink = useCallback(
    async (objectId: string) => {
      const url = `${window.location.origin}${window.location.pathname}?focus=${objectId}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link copied');
      } catch {
        await dialogPrompt('Copy link to object:', url, 'Object link');
      }
    },
    [showToast],
  );

  // Restore camera/tool for this room+tab before paint. ?focus= wins over camera.
  useLayoutEffect(() => {
    sessionRestored.current = false;
    const snap = loadRoomSession(conn.roomId, conn.identity.id);
    const hasFocus = new URLSearchParams(window.location.search).has('focus');
    if (snap?.view && !hasFocus) {
      useViewStore.getState().setView(snap.view);
    } else if (!hasFocus) {
      useViewStore.getState().setView({ x: 0, y: 0, scale: 1 });
    }
    useUiStore.setState({
      tool: snap?.tool ?? 'select',
      selectedId: null,
      selectedIds: [],
    });
    setOrbitOpen(snap?.orbitOpen ?? false);
  }, [conn.roomId, conn.identity.id]);

  // Restore selection after IndexedDB/WS sync (ids may not exist yet on first paint).
  useEffect(() => {
    if (sessionRestored.current) return;
    if (new URLSearchParams(window.location.search).has('focus')) {
      sessionRestored.current = true;
      return;
    }
    const snap = loadRoomSession(conn.roomId, conn.identity.id);
    if (!snap?.selectedIds.length) {
      sessionRestored.current = true;
      return;
    }

    const tryApply = (finalAttempt: boolean) => {
      if (sessionRestored.current) return;
      const all = conn.getAllObjects();
      const ids = snap.selectedIds.filter((id) => !!all[id]);
      if (ids.length) {
        useUiStore.getState().setSelectedIds(ids);
        sessionRestored.current = true;
        return;
      }
      if (finalAttempt) sessionRestored.current = true;
    };

    tryApply(false);
    if (sessionRestored.current) return;

    const onSynced = () => tryApply(true);
    conn.persistence.once('synced', onSynced);
    const fallback = window.setTimeout(() => tryApply(true), 2500);
    return () => {
      window.clearTimeout(fallback);
      conn.persistence.off('synced', onSynced);
    };
  }, [conn, objects]);

  // Persist camera, tool, selection, and Orbit open while working in the room.
  useEffect(() => {
    const save = throttle(() => {
      const view = useViewStore.getState();
      const ui = useUiStore.getState();
      persistRoomSession(conn.roomId, conn.identity.id, {
        view: { x: view.x, y: view.y, scale: view.scale },
        selectedIds: ui.selectedIds,
        tool: ui.tool,
        orbitOpen,
      });
    }, 250);

    const unsubView = useViewStore.subscribe(save);
    const unsubUi = useUiStore.subscribe(save);
    save();

    const onHide = () => save();
    window.addEventListener('pagehide', onHide);
    return () => {
      unsubView();
      unsubUi();
      window.removeEventListener('pagehide', onHide);
      save();
    };
  }, [conn.roomId, conn.identity.id, orbitOpen]);

  // Deep link: ?focus=<objectId> centers once, pulses, then clears the query.
  useEffect(() => {
    if (focusHandled.current) return;
    const id = new URLSearchParams(window.location.search).get('focus');
    if (!id) {
      focusHandled.current = true;
      return;
    }

    const clearFocusQuery = () => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('focus')) return;
      url.searchParams.delete('focus');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    };

    const applyFocus = (o: CanvasObject) => {
      if (focusHandled.current) return;
      focusHandled.current = true;
      const scale = useViewStore.getState().scale;
      useViewStore.getState().setView({
        x: window.innerWidth / 2 - (o.x + o.width / 2) * scale,
        y: window.innerHeight / 2 - (o.y + o.height / 2) * scale,
      });
      setSelectedId(id);
      setFocusPulseId(id);
      clearFocusQuery();
      window.setTimeout(() => {
        setFocusPulseId((cur) => (cur === id ? null : cur));
      }, 1600);
    };

    if (objects[id]) {
      applyFocus(objects[id]);
      return;
    }

    const finishMissing = () => {
      if (focusHandled.current) return;
      focusHandled.current = true;
      clearFocusQuery();
      void dialogAlert('That object is gone.', 'Object link');
    };

    // Wait for IndexedDB/WS sync before declaring the object missing.
    let settleTimer: number | null = null;
    const scheduleMissingCheck = () => {
      if (settleTimer != null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (focusHandled.current) return;
        const found = conn.getAllObjects()[id];
        if (found) applyFocus(found);
        else finishMissing();
      }, 900);
    };

    conn.persistence.once('synced', scheduleMissingCheck);
    const fallback = window.setTimeout(scheduleMissingCheck, 3500);
    return () => {
      if (settleTimer != null) window.clearTimeout(settleTimer);
      window.clearTimeout(fallback);
      conn.persistence.off('synced', scheduleMissingCheck);
    };
  }, [conn, objects, setSelectedId]);

  // Broadcast our viewport (world coords) for the minimap radar + follow mode.
  useEffect(() => {
    const publish = throttle(() => {
      const { x, y, scale } = useViewStore.getState();
      conn.setPresence({
        viewport: {
          x: -x / scale,
          y: -y / scale,
          w: window.innerWidth / scale,
          h: window.innerHeight / scale,
        },
      });
    }, 120);
    publish();
    const unsubscribe = useViewStore.subscribe(publish);
    return unsubscribe;
  }, [conn]);

  // Follow mode: camera tracks the followed user's broadcast viewport.
  useEffect(() => {
    if (followClientId == null) return;
    const target = remoteUsers.find((u) => u.clientId === followClientId);
    const vp = target?.state.viewport;
    if (!vp) return;
    const scale = clamp(Math.min(window.innerWidth / vp.w, window.innerHeight / vp.h), ZOOM_MIN, ZOOM_MAX);
    useViewStore.getState().setView({
      scale,
      x: -vp.x * scale + (window.innerWidth - vp.w * scale) / 2,
      y: -vp.y * scale + (window.innerHeight - vp.h * scale) / 2,
    });
  }, [remoteUsers, followClientId]);

  // Paste / drag-drop images anywhere on the page.
  useEffect(() => {
    const place = async (files: FileList | File[], at?: { x: number; y: number }) => {
      const view = useViewStore.getState();
      const center = at
        ? screenToWorld(view, at.x, at.y)
        : screenToWorld(view, window.innerWidth / 2, window.innerHeight / 2);
      for (const file of Array.from(files)) {
        const obj = await fileToImageObject(file, center, conn.nextZ(), conn.identity.id);
        if (obj) conn.addObject(obj);
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files.length) void place(e.clipboardData.files);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files.length) void place(e.dataTransfer.files, { x: e.clientX, y: e.clientY });
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    window.addEventListener('paste', onPaste);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragover', onDragOver);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragover', onDragOver);
    };
  }, [conn]);

  const startReplay = useCallback(async () => {
    try {
      const entries = await fetchReplayLog(conn.roomId);
      if (entries.length === 0) {
        await dialogAlert(
          'Nothing has been recorded in this room yet. Recording starts automatically once the room is live on the server.',
          'No recording yet',
        );
        return;
      }
      const controller = new ReplayController(entries);
      useUiStore.getState().setSelectedId(null);
      setReplay({ controller, map: controller.seek(0) });
    } catch (err) {
      logger.error('Replay unavailable', err);
      const face = toUserFacingError(err, {
        title: 'Recording unavailable',
        message: 'We could not load this session recording. Check your connection and try again in a moment.',
      });
      await dialogAlert(face.message, { title: face.title, details: face.details });
    }
  }, [conn]);

  const exitReplay = useCallback(() => {
    setReplay((r) => {
      r?.controller.destroy();
      return null;
    });
  }, []);

  const openSessionHistory = useCallback(async (file: File) => {
    try {
      const parsed = parseSessionReplayFile(await file.text());
      if ('error' in parsed) {
        await dialogAlert(parsed.message, {
          title: 'Could not open session history',
          details: parsed.details,
        });
        return;
      }
      useUiStore.getState().setSelectedId(null);
      setReplay((current) => {
        current?.controller.destroy();
        const controller = new ReplayController(parsed.entries);
        return { controller, map: controller.seek(0) };
      });
    } catch (err) {
      logger.error('Session history open failed', err);
      const face = toUserFacingError(err, {
        title: 'Could not open session history',
        message: 'That file could not be read. Try another session history export from Replay.',
      });
      await dialogAlert(face.message, { title: face.title, details: face.details });
    }
  }, []);

  const objectList = useMemo(() => Object.values(displayObjects), [displayObjects]);
  const editingObj = editingId ? displayObjects[editingId] : undefined;
  const selected = selectedId ? displayObjects[selectedId] : undefined;

  const pasteAt = useCallback(
    (wx: number, wy: number) => {
      if (!clipboard.length) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const o of clipboard) {
        minX = Math.min(minX, o.x);
        minY = Math.min(minY, o.y);
        maxX = Math.max(maxX, o.x + o.width);
        maxY = Math.max(maxY, o.y + o.height);
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const created: string[] = [];
      for (const src of clipboard) {
        const copy: CanvasObject = {
          ...src,
          id: nanoid(OBJECT_ID_LENGTH),
          x: wx + (src.x - cx),
          y: wy + (src.y - cy),
          z: conn.nextZ(),
          impulse: null,
          createdBy: conn.identity.id,
        };
        conn.addObject(copy);
        created.push(copy.id);
      }
      if (created.length) useUiStore.getState().setSelectedIds(created);
    },
    [clipboard, conn],
  );

  const startPresentation = useCallback(
    async (fromFrameId?: string) => {
      const list = presentationFrames(displayObjects);
      if (list.length === 0) {
        await dialogAlert('Add one or more frames to the board, then present them as slides.', 'Presentation');
        return;
      }
      let start = 0;
      if (fromFrameId) {
        const i = list.findIndex((f) => f.id === fromFrameId);
        if (i >= 0) start = i;
      } else if (selectedId) {
        const i = list.findIndex((f) => f.id === selectedId);
        if (i >= 0) start = i;
      }
      setPresentIndex(start);
      setPresenting(true);
      setSelectedId(null);
      setContextMenu(null);
      setOrbitOpen(false);
      setTemplatesOpen(false);
      setBoardStartDismissed(true);
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {
        /* fullscreen is optional */
      }
    },
    [displayObjects, selectedId, setSelectedId],
  );

  const exitPresentation = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!presenting) return;
    if (frames.length === 0) {
      exitPresentation();
      return;
    }
    if (presentIndex > frames.length - 1) setPresentIndex(frames.length - 1);
  }, [exitPresentation, frames.length, presentIndex, presenting]);

  const handleContextAction = useCallback(
    (action: ContextAction) => {
      if (!contextMenu) return;
      const { world, targetId } = contextMenu;
      const target = targetId ? objects[targetId] : undefined;

      switch (action.type) {
        case 'paste':
          pasteAt(world.x, world.y);
          break;
        case 'insert': {
          const id = nanoid(OBJECT_ID_LENGTH);
          const base = { id, rotation: 0, z: conn.nextZ(), createdBy: conn.identity.id };
          let obj: CanvasObject | null = null;
          const paint = shapePaintFromFill(fillColor);
          if (action.tool === 'rect')
            obj = {
              ...base,
              type: 'rect',
              ...paint,
              x: world.x - DEFAULTS.rect.width / 2,
              y: world.y - DEFAULTS.rect.height / 2,
              ...DEFAULTS.rect,
            };
          if (action.tool === 'ellipse')
            obj = {
              ...base,
              type: 'ellipse',
              ...paint,
              x: world.x - DEFAULTS.ellipse.width / 2,
              y: world.y - DEFAULTS.ellipse.height / 2,
              ...DEFAULTS.ellipse,
            };
          if (action.tool === 'sticky') {
            const fill = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
            obj = {
              ...base,
              type: 'sticky',
              fill,
              text: '',
              x: world.x - DEFAULTS.sticky.width / 2,
              y: world.y - DEFAULTS.sticky.height / 2,
              ...DEFAULTS.sticky,
            };
          }
          if (action.tool === 'text')
            obj = {
              ...base,
              type: 'text',
              fill: '#e9ecef',
              text: '',
              fontSize: DEFAULT_FONT_SIZE,
              x: world.x - DEFAULTS.text.width / 2,
              y: world.y - DEFAULTS.text.height / 2,
              ...DEFAULTS.text,
            };
          if (action.tool === 'code')
            obj = createCodeObject({
              id,
              centerX: world.x,
              centerY: world.y,
              z: base.z,
              createdBy: base.createdBy,
            });
          if (action.tool === 'frame')
            obj = {
              ...base,
              type: 'frame',
              fill: 'rgba(66,98,255,0.08)',
              stroke: '#4262ff',
              strokeWidth: 2,
              text: 'Frame',
              x: world.x - DEFAULTS.frame.width / 2,
              y: world.y - DEFAULTS.frame.height / 2,
              ...DEFAULTS.frame,
            };
          if (obj) {
            conn.addObject(obj);
            setSelectedId(id);
            if (obj.type === 'sticky' || obj.type === 'text' || obj.type === 'frame' || obj.type === 'code') {
              setEditingId(id);
            }
          }
          break;
        }
        case 'selectAll': {
          const ids = Object.keys(objects).filter(
            (id) => objects[id].type !== 'connector' && objects[id].type !== 'rope',
          );
          useUiStore.getState().setSelectedIds(ids);
          break;
        }
        case 'zoomFit': {
          const b = worldBounds(objectList);
          if (!b) {
            useViewStore.getState().setView({ x: 0, y: 0, scale: 1 });
            break;
          }
          const pad = 80;
          const w = b.maxX - b.minX + pad * 2;
          const h = b.maxY - b.minY + pad * 2;
          const s = clamp(Math.min(window.innerWidth / w, window.innerHeight / h), ZOOM_MIN, 1.5);
          useViewStore.getState().setView({
            scale: s,
            x: -b.minX * s + (window.innerWidth - (b.maxX - b.minX) * s) / 2,
            y: -b.minY * s + (window.innerHeight - (b.maxY - b.minY) * s) / 2,
          });
          break;
        }
        case 'zoom100':
          useViewStore.getState().setView({ scale: 1, x: 0, y: 0 });
          break;
        case 'duplicate':
          if (target) {
            const copy = {
              ...target,
              id: nanoid(OBJECT_ID_LENGTH),
              x: target.x + 24,
              y: target.y + 24,
              z: conn.nextZ(),
              impulse: null,
              createdBy: conn.identity.id,
            };
            conn.addObject(copy);
            setSelectedId(copy.id);
          }
          break;
        case 'copy':
          if (target) setClipboard([{ ...target }]);
          break;
        case 'cut':
          if (target && !target.locked && conn.canDeleteObject(target.id)) {
            setClipboard([{ ...target }]);
            conn.deleteObject(target.id);
            setSelectedId(null);
          }
          break;
        case 'delete':
          if (target && conn.canDeleteObject(target.id)) {
            conn.deleteObject(target.id);
            setSelectedId(null);
          }
          break;
        case 'bringFront':
          if (target) conn.updateObject(target.id, { z: conn.nextZ() });
          break;
        case 'sendBack':
          if (target) conn.updateObject(target.id, { z: 0 });
          break;
        case 'togglePhysics':
          if (target) conn.updateObject(target.id, { physics: !target.physics, impulse: null });
          break;
        case 'toggleLock':
          if (target) conn.updateObject(target.id, { locked: !target.locked });
          break;
        case 'copyLink':
          if (target) void copyObjectLink(target.id);
          break;
        case 'presentFrom':
          if (target?.type === 'frame') void startPresentation(target.id);
          break;
        case 'moveDialog':
          if (target) setMoveOpen(true);
          break;
        case 'clearContent':
          if (target) conn.updateObject(target.id, { text: '' });
          break;
        case 'comment': {
          const world = contextMenu?.world ?? { x: 0, y: 0 };
          setCommentDraft(makeCommentDraft(world, target));
          break;
        }
      }
    },
    [
      contextMenu,
      objects,
      objectList,
      pasteAt,
      conn,
      fillColor,
      setSelectedId,
      setClipboard,
      setCommentDraft,
      copyObjectLink,
      startPresentation,
    ],
  );

  const handleImport = useCallback(
    async (file: File) => {
      const result = await importBoardJSON(file, conn);
      if (!result.ok) {
        await dialogAlert(
          'We could not import that board. Use a Gravity board JSON export and try again.',
          { title: 'Import failed', details: result.error },
        );
        return;
      }
      await dialogAlert(`Imported ${result.count} objects. They sync to everyone in the room.`, 'Import complete');
    },
    [conn],
  );

  const openOrbit = useCallback((seed?: string, voice?: { dataUrl: string; seconds: number }) => {
    setOrbitSeed(seed);
    setOrbitSeedVoice(voice ?? null);
    setOrbitOpen(true);
  }, []);

  const handleDiagramAction = useCallback(
    (id: string, action: 'shapes' | 'template' | 'ai') => {
      if (!canInteract) return;
      conn.updateObject(id, { diagramEmpty: false });
      if (action === 'template') {
        setTemplatesNav('diagram');
        setTemplatesOpen(true);
        return;
      }
      if (action === 'ai') {
        openOrbit('Create a clear flowchart diagram on this board now (shapes + connectors)');
        return;
      }
      // Add shapes — arm the rectangle tool so the next click drops into the board.
      useUiStore.getState().setTool('rect');
    },
    [canInteract, conn, openOrbit],
  );

  return (
    <div
      className={`room ${chromeReady ? 'room-chrome-ready' : 'room-chrome-warming'} ${replay ? 'replay-active' : ''} ${orbitOpen && chromeReady ? 'sidekick-open' : ''} ${presenting ? 'presenting' : ''} ${embedMode ? 'room-embed' : ''}`}
    >
      <main id="canvas-main" aria-label="Infinite canvas">
        <CanvasStage
          conn={conn}
          objects={displayObjects}
          remoteUsers={remoteUsers}
          interactive={canInteract}
          stageRef={stageRef}
          editingId={editingId}
          onEditText={setEditingId}
          onDiagramAction={canInteract ? handleDiagramAction : undefined}
          onContextMenu={
            canInteract
              ? (info) =>
                  setContextMenu({
                    x: info.screen.x,
                    y: info.screen.y,
                    world: info.world,
                    targetId: info.targetId,
                  })
              : undefined
          }
        />
        {!replay && !presenting && <ReactionsOverlay conn={conn} />}
        {!presenting && <ImageObjectsOverlay objects={objectList} />}
        {!presenting && <MediaResourceOverlay objects={objectList} interactive={canInteract} />}
        {!presenting && <EmbedObjectsOverlay objects={objectList} interactive={canInteract} />}
      </main>

      {!replay && !access.canEdit && !presenting && (
        <div className="view-only-banner panel" role="status">
          <span>
            Viewing only
            {access.hasPendingRequest ? ' · edit request pending' : ''}
          </span>
          {access.hasPendingRequest ? (
            <em>Waiting for the owner</em>
          ) : (
            <button type="button" className="btn btn-accent" onClick={() => access.requestEditAccess()}>
              Request edit access
            </button>
          )}
        </div>
      )}

      {embedMode && (
        <a className="embed-open-app" href={fullAppHref} target="_blank" rel="noreferrer">
          Open in Gravity
        </a>
      )}

      {!presenting && !embedMode && (
      <PresenceBar
        conn={conn}
        remoteUsers={remoteUsers}
        status={status}
        onExportPNG={() => stageRef.current && exportPNG(stageRef.current, objectList)}
        onExportSVG={() => exportSVG(objectList)}
        onExportJSON={() => exportJSON(objectList)}
        onImportJSON={(file) => void handleImport(file)}
        onOpenSessionHistory={(file) => void openSessionHistory(file)}
        onReplay={() => void startReplay()}
        replayActive={!!replay}
        onTemplates={() => {
          setTemplatesNav('all');
          setTemplatesOpen(true);
        }}
        onOrbit={() => setOrbitOpen((v) => !v)}
        onPresent={() => void startPresentation()}
        presentDisabled={frames.length === 0}
        onTakeTour={() => {
          window.setTimeout(() => startProductTour({ force: true }), PRODUCT_TOUR_START_DELAY_MS);
        }}
      />
      )}

      {templatesOpen && canInteract && !embedMode && (
        <TemplatesModal
          key={templatesNav}
          conn={conn}
          initialNav={templatesNav}
          onClose={() => {
            setTemplatesOpen(false);
            setTemplatesNav('all');
          }}
          onOpenOrbit={() => openOrbit()}
        />
      )}
      {!replay && !embedMode && (
        <SidekickPanel
          open={orbitOpen && chromeReady}
          objects={displayObjects}
          conn={canInteract ? conn : undefined}
          userName={conn.identity.name}
          roomId={conn.roomId}
          initialPrompt={orbitSeed}
          initialVoice={orbitSeedVoice}
          onInitialVoiceConsumed={() => setOrbitSeedVoice(null)}
          onClose={() => {
            setOrbitOpen(false);
            setOrbitSeed(undefined);
          }}
          onUseTemplate={
            canInteract
              ? () => {
                  setOrbitOpen(false);
                  setTemplatesOpen(true);
                }
              : undefined
          }
        />
      )}

      {canInteract && !presenting && !embedMode && (
        <Toolbar conn={conn} objectsCount={objectList.length} />
      )}
      {!presenting && !embedMode && <Minimap objects={displayObjects} remoteUsers={remoteUsers} />}
      {!replay && !presenting && !embedMode && <ZoomControls objects={displayObjects} conn={conn} />}
      {canInteract && !presenting && !embedMode && <CommentsLayer conn={conn} comments={comments} objects={displayObjects} />}

      {presenting && (
        <PresentationOverlay
          objects={displayObjects}
          index={presentIndex}
          roomId={conn.roomId}
          onIndexChange={setPresentIndex}
          onExit={exitPresentation}
        />
      )}

      {selected && canInteract && !editingId && !presenting && !embedMode && (
        <SelectionToolbar
          conn={conn}
          obj={selected}
          identity={conn.identity}
          onPatch={(patch) => conn.updateObject(selected.id, patch)}
          onDuplicate={() => {
            const copy = {
              ...selected,
              id: nanoid(OBJECT_ID_LENGTH),
              x: selected.x + 24,
              y: selected.y + 24,
              z: conn.nextZ(),
              impulse: null,
              votes: [],
              createdBy: conn.identity.id,
            };
            conn.addObject(copy);
            setSelectedId(copy.id);
          }}
          canDelete={conn.canDeleteObject(selected.id)}
          onDelete={() => {
            if (!conn.canDeleteObject(selected.id)) return;
            conn.deleteObject(selected.id);
            setSelectedId(null);
          }}
          onToggleLock={() => conn.updateObject(selected.id, { locked: !selected.locked })}
          onTogglePhysics={() => conn.updateObject(selected.id, { physics: !selected.physics, impulse: null })}
          onSettle={() => settleObjects(conn, [selected.id])}
          onToggleMagnet={() => toggleMagnetRole(conn, selected.id)}
          onRestoreArchived={() =>
            conn.updateObject(selected.id, { archived: undefined, physics: true, opacity: 1 })
          }
          onOrbit={() => openOrbit(`Help me work with this ${selected.type}`)}
          onEditText={() => setEditingId(selected.id)}
          onComment={() =>
            setCommentDraft(
              makeCommentDraft({ x: selected.x + selected.width - 12, y: selected.y + 10 }, selected),
            )
          }
          onCopyLink={() => void copyObjectLink(selected.id)}
          onAddMindMapChild={
            selected.mindMapId
              ? () => {
                  const child = addMindMapChild(conn, selected);
                  if (child) {
                    setSelectedId(child.id);
                    setEditingId(child.id);
                  }
                }
              : undefined
          }
          onLayoutMindMap={
            selected.mindMapId ? () => layoutMindMap(conn, selected.mindMapId!) : undefined
          }
          onToggleMindMapCollapse={
            selected.mindMapId
              ? () => {
                  conn.updateObject(selected.id, { mindMapCollapsed: !selected.mindMapCollapsed });
                  layoutMindMap(conn, selected.mindMapId!);
                }
              : undefined
          }
          onRevealPrivateIdea={
            selected.privateAuthorId === conn.identity.id && !selected.privateRevealed
              ? () => conn.revealPrivateIdea(selected.id)
              : undefined
          }
        />
      )}

      {focusPulseId && displayObjects[focusPulseId] && <ObjectFocusPulse obj={displayObjects[focusPulseId]} />}

      {toast && (
        <div className="app-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {selected && canInteract && moveOpen && (
        <MoveDialog
          obj={selected}
          onMove={(x, y) => conn.updateObject(selected.id, { x, y })}
          onClose={() => setMoveOpen(false)}
        />
      )}

      {contextMenu && canInteract && (
        <ContextMenu
          menu={contextMenu}
          selected={contextMenu.targetId ? displayObjects[contextMenu.targetId] : selected}
          canPaste={clipboard.length > 0}
          canSelectAll={objectList.some((o) => o.type !== 'connector' && o.type !== 'rope')}
          canDeleteSelected={
            !(contextMenu.targetId ? displayObjects[contextMenu.targetId] : selected) ||
            conn.canDeleteObject((contextMenu.targetId ? displayObjects[contextMenu.targetId] : selected)!.id)
          }
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {replay && (
        <ReplayBar
          controller={replay.controller}
          roomId={conn.roomId}
          stageRef={stageRef}
          onUpdate={(map) => setReplay((r) => (r ? { ...r, map } : r))}
          onExit={exitReplay}
        />
      )}

      {editingObj?.type === 'code' && canInteract && (
        <Suspense fallback={null}>
          <CodeEditOverlay
            obj={editingObj}
            conn={conn}
            onLanguageChange={(language) => conn.updateObject(editingObj.id, { language })}
            onClose={() => setEditingId(null)}
          />
        </Suspense>
      )}

      {editingObj?.type === 'table' && editingObj.records && canInteract && (
        <StructuredDataOverlay
          obj={editingObj}
          onPatch={(patch) => conn.updateObject(editingObj.id, patch)}
          onClose={() => setEditingId(null)}
        />
      )}

      {editingObj && editingObj.type !== 'code' && !(editingObj.type === 'table' && editingObj.records) && canInteract && (
        <TextEditOverlay
          obj={editingObj}
          onCommit={(value) => {
            if (editingObj.type === 'table') conn.updateObject(editingObj.id, { cells: value });
            else conn.updateObject(editingObj.id, { text: value });
          }}
          onClose={() => setEditingId(null)}
        />
      )}

      {boardStartVisible && (
          <BoardStartModal
            userName={conn.identity.name}
            onClose={() => setBoardStartDismissed(true)}
            onOpenTemplates={() => setTemplatesOpen(true)}
            onOpenOrbit={(seed, voice) => openOrbit(seed, voice)}
          />
        )}

      <div className="sr-live" aria-live="polite" aria-atomic="true">
        {status === 'offline' ? 'You are offline. Edits stay local until you reconnect.' : ''}
      </div>

      {/* Survives Exit from session replay; does not touch the live Yjs doc. */}
      <ReplayExportHost />

      {!embedMode && !presenting && <InstallPrompt />}
    </div>
  );
}

/** Brief highlight ring when opening a ?focus= deep link. */
function ObjectFocusPulse({ obj }: { obj: CanvasObject }) {
  const view = useViewStore();
  const left = obj.x * view.scale + view.x - 6;
  const top = obj.y * view.scale + view.y - 6;
  const width = Math.max(24, obj.width * view.scale + 12);
  const height = Math.max(24, obj.height * view.scale + 12);
  return (
    <div
      className="object-focus-pulse"
      aria-hidden
      style={{ left, top, width, height }}
    />
  );
}
