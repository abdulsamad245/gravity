import type { ChartKind, ChartSeries } from '../constants/chart.constants';
import type { ConnectorStyle } from '../constants/connector.constants';
import type { ObjectType, ToolId } from '../constants/object-types';
import type { CodeLanguage } from '../constants/code.constants';

export type StructuredViewMode = 'table' | 'kanban' | 'timeline';
export type { ChartKind, ChartSeries, ConnectorStyle };

export interface StructuredRecord {
  id: string;
  title: string;
  description?: string;
  status: string;
  start?: string;
  end?: string;
  priority?: string;
}

/**
 * Canonical canvas object schema shared by rendering, sync, physics, export,
 * and replay. Stored in Yjs as nested maps so tiny updates (a physics position
 * tick) sync a few bytes without re-sending embedded media.
 */
export interface CanvasObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees around the object center (matches Matter.js). */
  rotation: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  /** CSS font stack (see FONT_OPTIONS). */
  fontFamily?: string;
  /** Konva fontStyle: normal | bold | italic | bold italic */
  fontStyle?: string;
  /** Konva textDecoration: underline and/or line-through */
  textDecoration?: string;
  align?: 'left' | 'center' | 'right';
  /** Text ink when `fill` is the shape/sticky background. */
  textColor?: string;
  /** Marker-style highlight behind text (hex). */
  highlight?: string;
  /** Whole-object list formatting for sticky/text/frame. */
  listStyle?: 'none' | 'bullet' | 'numbered';
  /** Indent level for list / text block (0–6). */
  indent?: number;
  /** Optional hyperlink on a text-capable object. */
  href?: string;
  /** Syntax used to highlight code-block source stored in `text`. */
  language?: CodeLanguage;
  opacity?: number;
  /** Freehand stroke points relative to (x, y): [x0, y0, x1, y1, ...]. */
  points?: number[];
  /** Connector/rope endpoints; centers resolved at render time. */
  fromId?: string;
  toId?: string;
  /** Routing for object-linked connectors (default straight). */
  connectorStyle?: ConnectorStyle;
  /** Image/video/file data URL or durable `/api/v1/media/...` path; embed http(s) URL. */
  src?: string;
  audio?: string;
  audioDuration?: number;
  /** MIME for video/file resources (helps overlays and offline promote). */
  mimeType?: string;
  /** Original filename for file/video cards. */
  fileName?: string;
  /** Chart variant + sample/editable series. */
  chartKind?: ChartKind;
  chartCategories?: string[];
  chartSeries?: ChartSeries[];
  /** Physics is opt-in per object. */
  physics?: boolean;
  locked?: boolean;
  /** Throw request; physics host applies and clears. */
  impulse?: { vx: number; vy: number; t: number } | null;
  /** Table cells as row-major CSV. */
  cells?: string;
  /** Record-backed structured data; one dataset can switch views. */
  records?: StructuredRecord[];
  dataView?: StructuredViewMode;
  /** Semantic mind-map membership and parent relationship. */
  mindMapId?: string;
  mindMapParentId?: string;
  mindMapCollapsed?: boolean;
  /**
   * Prefer `{ id, name, color, at }`; legacy boards may still have bare identity id strings.
   */
  votes?: Array<ObjectVote | string>;
  /**
   * Frame / sticky subtype.
   * - `diagram` = container with boundary and optional quick-start empty state
   * - `magnet` = topic magnet that pulls nearby physics objects
   * - `archiveWell` = zone that pulls objects in and parks them
   */
  role?: 'diagram' | 'magnet' | 'archiveWell';
  /** Quick-start empty state (only when role is diagram). */
  diagramEmpty?: boolean;
  /** Parked by an archive well (hidden from default physics; kept on the board). */
  archived?: boolean;
  z: number;
  /** Creator identity id (legacy boards may store display name). */
  createdBy?: string;
  /** Sticky author captured during a private brainstorming round. */
  privateAuthorId?: string;
  /** Matches PrivateBrainstormState.startedAt for the round that created this sticky. */
  privateRoundId?: number;
  /** Author explicitly revealed this sticky before the round ended. */
  privateRevealed?: boolean;
  /** Derived locally for rendering only; never intentionally persisted. */
  privateHidden?: boolean;
}

/** Vote stored with display fields so details survive disconnects. */
export interface ObjectVote {
  id: string;
  name: string;
  color: string;
  /** Epoch ms when cast (0 = unknown / legacy). */
  at: number;
}

/** Guest identity (auth seam - mirrors the backend Identity type). */
export interface Identity {
  kind: 'guest' | 'user';
  name: string;
  id: string;
  color: string;
  /** Optional profile photo as a small data URL (shown in avatar circles). */
  avatar?: string;
}

/** Shared workshop timer (last-write-wins via updatedAt). */
export interface SharedTimerState {
  /** Wall-clock end while running. */
  endsAt: number | null;
  /** Leftover ms while paused. */
  pausedMs: number | null;
  /** Ambient bed id, or null for silence. */
  musicId: string | null;
  updatedAt: number;
}

export interface PrivateBrainstormState {
  active: boolean;
  startedBy: string;
  startedAt: number;
  anonymous: boolean;
}

export type VotingSessionStatus = 'active' | 'revealed';

export interface VotingSession {
  id: string;
  prompt: string;
  voteLimit: number;
  status: VotingSessionStatus;
  startedBy: string;
  startedAt: number;
  revealedAt?: number;
  /** When true (default), results show counts only, not who voted for what. */
  anonymous?: boolean;
  /** Optional session length in seconds. */
  durationSec?: number;
  /** Absolute end time when a duration was set at start. */
  endsAt?: number;
}

export interface WorkshopVoter {
  id: string;
  name: string;
  color: string;
  /** Participant signaled they finished casting votes. */
  done?: boolean;
}

export interface WorkshopState {
  privateBrainstorm: PrivateBrainstormState | null;
  voting: VotingSession | null;
  ballots: Record<string, string[]>;
  voters: Record<string, WorkshopVoter>;
}

/** Ephemeral reaction; TTL-cleared by the publisher. */
export interface PresenceReaction {
  glyph: string;
  x: number;
  y: number;
  at: number;
}

/** Ephemeral per-user presence via Yjs awareness. */
export interface AwarenessState {
  user: { name: string; color: string; id: string; avatar?: string };
  cursor: { x: number; y: number } | null;
  viewport: { x: number; y: number; w: number; h: number } | null;
  attract: { x: number; y: number; dir: 1 | -1 } | null;
  /** Facilitator wind: force vector applied near (x, y). */
  wind?: { x: number; y: number; vx: number; vy: number } | null;
  /** One-shot shake burst (host applies while `at` is recent). */
  shake?: { at: number; x: number; y: number; strength: number } | null;
  laser: { points: number[]; color: string } | null;
  /** Full shared timer snapshot (preferred). */
  timer?: SharedTimerState | null;
  /** Legacy running end time - kept for older tabs. */
  timerEndsAt: number | null;
  reaction?: PresenceReaction | null;
  handRaised?: boolean;
  /** Shared board-gravity switch (last write wins via boardGravityAt). */
  boardGravity?: boolean;
  boardGravityAt?: number;
}

export interface ViewState {
  x: number;
  y: number;
  scale: number;
}

export interface CommentMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  text: string;
  createdAt: number;
}

/**
 * Collaborative comment pin. Anchored comments follow their target via
 * (ox, oy) offsets; free pins use absolute world (x, y).
 */
export interface CanvasComment {
  id: string;
  x: number;
  y: number;
  ox: number;
  oy: number;
  targetId: string | null;
  resolved: boolean;
  messages: CommentMessage[];
}

/** Local (unsynced) pin while composing the first message. */
export interface CommentDraft {
  x: number;
  y: number;
  ox: number;
  oy: number;
  targetId: string | null;
}

export type { ObjectType, ToolId };
