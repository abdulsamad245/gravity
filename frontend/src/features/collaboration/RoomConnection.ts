import * as Y from 'yjs';
import { nanoid } from 'nanoid';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import { WS_BASE_URL } from '../../shared/constants/app.constants';
import { GRAVITY } from '../../shared/constants/colors.constants';
import { OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import {
  VOTING_PROMPT_MAX,
  VOTING_VOTE_LIMIT_MAX,
  VOTING_VOTE_LIMIT_MIN,
} from '../../shared/constants/facilitation.constants';
import { TX_ORIGIN_LOCAL } from '../../shared/constants/physics.constants';
import { logger } from '../../shared/logging/logger';
import type {
  AwarenessState,
  CanvasComment,
  CanvasObject,
  CommentMessage,
  Identity,
  PrivateBrainstormState,
  VotingSession,
  WorkshopVoter,
} from '../../shared/types';
import {
  deriveCanEdit,
  type EditAccessRequest,
  type LinkAccess,
  type RoomAccessState,
} from '../../shared/types/room-access';
import { canDeleteComment as ownershipCanDeleteComment, canDeleteObject as ownershipCanDeleteObject } from '../../shared/utils/ownership';
import {
  mergeBallotsOntoObjectVotes,
  votersForObjectId,
} from '../../shared/utils/voting-session';

export type ConnectionStatus = 'connecting' | 'reconnecting' | 'online' | 'offline';

/**
 * One live connection to a room. Wraps the whole Yjs stack:
 *
 * - Y.Doc            — the shared CRDT document (objects live in a Y.Map of Y.Maps)
 * - WebsocketProvider — real-time sync with the backend (auto-reconnects)
 * - IndexeddbPersistence — local cache for offline edits; merges on reconnect via Yjs
 * - awareness        — ephemeral presence: cursors, viewports, attractors
 *
 * Local user edits use the TX_ORIGIN_LOCAL transaction origin so the
 * UndoManager only tracks *your* changes; physics writes use their own
 * origin to break echo loops.
 */
export class RoomConnection {
  readonly doc = new Y.Doc();
  readonly objects: Y.Map<Y.Map<unknown>>;
  /** Shared comment pins / threads (separate from canvas objects). */
  readonly comments: Y.Map<Y.Map<unknown>>;
  /** Shared board metadata (title, etc.). Synced with the room. */
  readonly meta: Y.Map<unknown>;
  /** Shared facilitation configuration. */
  readonly workshop: Y.Map<unknown>;
  /** One CRDT array per voter prevents concurrent ballots from overwriting each other. */
  readonly votingBallots: Y.Map<Y.Array<string>>;
  readonly votingVoters: Y.Map<WorkshopVoter>;
  readonly provider: WebsocketProvider;
  readonly persistence: IndexeddbPersistence;
  readonly undoManager: Y.UndoManager;

  constructor(
    readonly roomId: string,
    readonly identity: Identity,
  ) {
    this.objects = this.doc.getMap('objects');
    this.comments = this.doc.getMap('comments');
    this.meta = this.doc.getMap('meta');
    this.workshop = this.doc.getMap('workshop');
    this.votingBallots = this.doc.getMap('votingBallots');
    this.votingVoters = this.doc.getMap('votingVoters');
    this.persistence = new IndexeddbPersistence(`gravity-room-${roomId}`, this.doc);
    this.provider = new WebsocketProvider(WS_BASE_URL, roomId, this.doc, {
      connect: true,
      maxBackoffTime: 4000,
    });
    this.undoManager = new Y.UndoManager([this.objects, this.comments], {
      trackedOrigins: new Set([TX_ORIGIN_LOCAL]),
      captureTimeout: 350,
    });

    this.provider.awareness.setLocalState({
      user: {
        name: identity.name,
        color: identity.color,
        id: identity.id,
        ...(identity.avatar ? { avatar: identity.avatar } : {}),
      },
      cursor: null,
      viewport: null,
      attract: null,
      wind: null,
      shake: null,
      laser: null,
      timer: null,
      timerEndsAt: null,
      reaction: null,
      handRaised: false,
    } satisfies AwarenessState);

    logger.info('Joined room', roomId);

    if (import.meta.env.DEV) {
      // Dev-only seam for the e2e suite: lets tests sever the socket to
      // simulate real network loss (stripped from production builds).
      (window as unknown as Record<string, unknown>).__gravityProvider = this.provider;
    }
  }

  get awareness() {
    return this.provider.awareness;
  }

  getObject(id: string): CanvasObject | undefined {
    return this.objects.get(id)?.toJSON() as CanvasObject | undefined;
  }

  getAllObjects(): Record<string, CanvasObject> {
    const out: Record<string, CanvasObject> = {};
    this.objects.forEach((v, k) => {
      out[k] = v.toJSON() as CanvasObject;
    });
    return out;
  }

  nextZ(): number {
    let max = 0;
    this.objects.forEach((v) => {
      const z = (v.get('z') as number) ?? 0;
      if (z > max) max = z;
    });
    return max + 1;
  }

  /** Creates an object (local-origin transaction → undoable). */
  addObject(obj: CanvasObject): void {
    if (!this.canEdit()) return;
    const privateRound = this.getPrivateBrainstorm();
    const objectToAdd =
      obj.type === 'sticky' && privateRound?.active
        ? {
            ...obj,
            privateAuthorId: this.identity.id,
            privateRoundId: privateRound.startedAt,
            privateRevealed: false,
          }
        : obj;
    this.doc.transact(() => {
      const m = new Y.Map<unknown>();
      for (const [k, v] of Object.entries(objectToAdd)) {
        if (v === undefined) continue;
        if (objectToAdd.type === 'code' && k === 'text' && typeof v === 'string') {
          const source = new Y.Text();
          source.insert(0, v);
          m.set(k, source);
        } else {
          m.set(k, v);
        }
      }
      this.objects.set(obj.id, m);
    }, TX_ORIGIN_LOCAL);
  }

  /**
   * Patches individual fields of an object. Nested-map writes keep the
   * update tiny (critical for 30Hz physics ticks and drag streaming).
   */
  updateObject(id: string, patch: Partial<CanvasObject>, origin: string = TX_ORIGIN_LOCAL): void {
    if (!this.canEdit()) return;
    const m = this.objects.get(id);
    if (!m) return;
    this.doc.transact(() => {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) {
          m.delete(k);
          continue;
        }
        const current = m.get(k);
        if (k === 'text' && current instanceof Y.Text && typeof v === 'string') {
          current.delete(0, current.length);
          current.insert(0, v);
        } else {
          m.set(k, v);
        }
      }
    }, origin);
  }

  /** Returns a collaborative text type for code editing, migrating legacy string values in place. */
  getCodeText(id: string): Y.Text | null {
    const object = this.objects.get(id);
    if (!object || object.get('type') !== 'code') return null;
    const current = object.get('text');
    if (current instanceof Y.Text) return current;
    const source = new Y.Text();
    if (typeof current === 'string' && current) source.insert(0, current);
    this.doc.transact(() => object.set('text', source), TX_ORIGIN_LOCAL);
    return source;
  }

  /** Whether this client may delete the object (any editor; private ideas stay personal). */
  canDeleteObject(id: string): boolean {
    return ownershipCanDeleteObject(this.getObject(id), this.identity, {
      canEdit: this.canEdit(),
      isRoomOwner: this.isOwner(),
    });
  }

  deleteObject(id: string): void {
    if (!this.canDeleteObject(id)) return;
    this.doc.transact(() => {
      this.objects.delete(id);
      // Free ballot slots so deleted stickies cannot trap someone at the vote limit.
      this.votingBallots.forEach((ballot) => {
        for (let i = ballot.length - 1; i >= 0; i -= 1) {
          if (ballot.get(i) === id) ballot.delete(i, 1);
        }
      });
    }, TX_ORIGIN_LOCAL);
  }

  getComment(id: string): CanvasComment | undefined {
    const raw = this.comments.get(id)?.toJSON() as CanvasComment | undefined;
    return raw ? { ...raw, id, messages: Array.isArray(raw.messages) ? raw.messages : [] } : undefined;
  }

  addComment(comment: CanvasComment): void {
    if (!this.canEdit()) return;
    this.doc.transact(() => {
      const m = new Y.Map<unknown>();
      for (const [k, v] of Object.entries(comment)) {
        if (v !== undefined) m.set(k, v);
      }
      this.comments.set(comment.id, m);
    }, TX_ORIGIN_LOCAL);
  }

  updateComment(id: string, patch: Partial<CanvasComment>): void {
    if (!this.canEdit()) return;
    const m = this.comments.get(id);
    if (!m) return;
    this.doc.transact(() => {
      for (const [k, v] of Object.entries(patch)) m.set(k, v);
    }, TX_ORIGIN_LOCAL);
  }

  appendCommentMessage(id: string, message: CommentMessage): void {
    if (!this.canEdit()) return;
    const m = this.comments.get(id);
    if (!m) return;
    this.doc.transact(() => {
      const prev = (m.get('messages') as CommentMessage[] | undefined) ?? [];
      m.set('messages', [...prev, message]);
      if (m.get('resolved') === true) m.set('resolved', false);
    }, TX_ORIGIN_LOCAL);
  }

  /** Whether this client may delete the comment thread (any editor). */
  canDeleteComment(id: string): boolean {
    return ownershipCanDeleteComment(this.getComment(id), this.identity, {
      canEdit: this.canEdit(),
      isRoomOwner: this.isOwner(),
    });
  }

  deleteComment(id: string): void {
    if (!this.canDeleteComment(id)) return;
    this.doc.transact(() => this.comments.delete(id), TX_ORIGIN_LOCAL);
  }

  getBoardTitle(): string {
    const t = this.meta.get('title');
    return typeof t === 'string' ? t : '';
  }

  setBoardTitle(title: string): void {
    if (!this.canEdit()) return;
    const next = title.trim().slice(0, 80);
    this.doc.transact(() => {
      if (next) this.meta.set('title', next);
      else this.meta.delete('title');
    }, TX_ORIGIN_LOCAL);
  }

  /** External voice/video call URL (Meet, Zoom, Discord, etc.) shared with the room. */
  getCallUrl(): string {
    const t = this.meta.get('callUrl');
    return typeof t === 'string' ? t : '';
  }

  setCallUrl(url: string): void {
    // Only the room creator may add, update, or remove the shared call link.
    if (!this.isOwner()) return;
    // Callers must pass validateCallUrl() output; empty clears.
    const next = url.trim().slice(0, 2048);
    this.doc.transact(() => {
      if (next) this.meta.set('callUrl', next);
      else this.meta.delete('callUrl');
    }, TX_ORIGIN_LOCAL);
  }

  getPrivateBrainstorm(): PrivateBrainstormState | null {
    const value = this.workshop.get('privateBrainstorm');
    if (!value || typeof value !== 'object') return null;
    const state = value as Partial<PrivateBrainstormState>;
    if (
      typeof state.active !== 'boolean' ||
      typeof state.startedBy !== 'string' ||
      typeof state.startedAt !== 'number'
    ) {
      return null;
    }
    return {
      active: state.active,
      startedBy: state.startedBy,
      startedAt: state.startedAt,
      anonymous: state.anonymous !== false,
    };
  }

  /** Start a private brainstorm (editors only); ideas stay hidden until revealed. */
  startPrivateBrainstorm(anonymous = true): void {
    if (!this.canEdit()) return;
    const state: PrivateBrainstormState = {
      active: true,
      startedBy: this.identity.id,
      startedAt: Date.now(),
      anonymous,
    };
    this.doc.transact(() => this.workshop.set('privateBrainstorm', state), TX_ORIGIN_LOCAL);
  }

  /** End private brainstorm; starter or room owner only. */
  endPrivateBrainstorm(): void {
    const state = this.getPrivateBrainstorm();
    if (!state || (state.startedBy !== this.identity.id && !this.isOwner())) return;
    this.doc.transact(() => this.workshop.delete('privateBrainstorm'), TX_ORIGIN_LOCAL);
  }

  revealPrivateIdea(objectId: string): void {
    const object = this.getObject(objectId);
    if (!object || object.privateAuthorId !== this.identity.id) return;
    this.updateObject(objectId, { privateRevealed: true });
  }

  getVotingSession(): VotingSession | null {
    const value = this.workshop.get('voting');
    if (!value || typeof value !== 'object') return null;
    const session = value as Partial<VotingSession>;
    if (
      typeof session.id !== 'string' ||
      typeof session.prompt !== 'string' ||
      typeof session.voteLimit !== 'number' ||
      (session.status !== 'active' && session.status !== 'revealed') ||
      typeof session.startedBy !== 'string' ||
      typeof session.startedAt !== 'number'
    ) {
      return null;
    }
    return {
      ...(session as VotingSession),
      anonymous: session.anonymous !== false,
      durationSec: typeof session.durationSec === 'number' ? session.durationSec : undefined,
      endsAt: typeof session.endsAt === 'number' ? session.endsAt : undefined,
      revealedAt: typeof session.revealedAt === 'number' ? session.revealedAt : undefined,
    };
  }

  /**
   * Start a hidden-ballot voting session; clears prior ballots (editors only).
   * Optional duration auto-reveals when `endsAt` is reached.
   */
  startVotingSession(
    prompt: string,
    voteLimit: number,
    options?: { anonymous?: boolean; durationSec?: number },
  ): void {
    if (!this.canEdit()) return;
    const durationSec = Math.max(0, Math.round(options?.durationSec ?? 0));
    const startedAt = Date.now();
    const session: VotingSession = {
      id: nanoid(OBJECT_ID_LENGTH),
      prompt: prompt.trim().slice(0, VOTING_PROMPT_MAX) || 'Vote for the strongest ideas',
      voteLimit: Math.max(
        VOTING_VOTE_LIMIT_MIN,
        Math.min(VOTING_VOTE_LIMIT_MAX, Math.round(voteLimit)),
      ),
      status: 'active',
      startedBy: this.identity.id,
      startedAt,
      anonymous: options?.anonymous !== false,
      ...(durationSec > 0
        ? { durationSec, endsAt: startedAt + durationSec * 1000 }
        : {}),
    };
    this.doc.transact(() => {
      this.votingBallots.clear();
      this.votingVoters.clear();
      this.workshop.set('voting', session);
    }, TX_ORIGIN_LOCAL);
  }

  /** Toggle this voter's ballot entry for `objectId` (per-voter Y.Array, capped by voteLimit). */
  toggleSessionVote(objectId: string): void {
    const session = this.getVotingSession();
    if (!session || session.status !== 'active' || !this.canEdit() || !this.objects.has(objectId)) return;
    this.doc.transact(() => {
      let ballot = this.votingBallots.get(this.identity.id);
      if (!ballot) {
        ballot = new Y.Array<string>();
        this.votingBallots.set(this.identity.id, ballot);
      }
      const votes = ballot.toArray();
      const existing = votes.indexOf(objectId);
      if (existing >= 0) ballot.delete(existing, 1);
      else if (votes.length < session.voteLimit) ballot.push([objectId]);
      this.votingVoters.set(this.identity.id, {
        id: this.identity.id,
        name: this.identity.name,
        color: this.identity.color,
        // Changing ballots after "I'm done" reopens their progress for the host.
        done: false,
      });
    }, TX_ORIGIN_LOCAL);
  }

  /** Voting completion signal so the host can see who finished. */
  setVotingDone(done: boolean): void {
    const session = this.getVotingSession();
    if (!session || session.status !== 'active' || !this.canEdit()) return;
    this.doc.transact(() => {
      this.votingVoters.set(this.identity.id, {
        id: this.identity.id,
        name: this.identity.name,
        color: this.identity.color,
        done,
      });
      if (!this.votingBallots.has(this.identity.id)) {
        this.votingBallots.set(this.identity.id, new Y.Array<string>());
      }
    }, TX_ORIGIN_LOCAL);
  }

  /**
   * Reveal results: write tallies onto objects (survive Clear + physics mass), then mark revealed.
   * Host/owner normally; any editor may force when the optional session timer expires.
   */
  revealVotingSession(options?: { forceDeadline?: boolean }): void {
    const session = this.getVotingSession();
    if (!session || session.status !== 'active') return;
    const isManager = session.startedBy === this.identity.id || this.isOwner();
    const deadlinePassed = !!session.endsAt && Date.now() >= session.endsAt;
    if (options?.forceDeadline) {
      if (!deadlinePassed || !this.canEdit()) return;
    } else if (!isManager) {
      return;
    }

    const revealedAt = Date.now();
    const anonymous = session.anonymous !== false;
    const ballots: Record<string, string[]> = {};
    this.votingBallots.forEach((ballot, voterId) => {
      ballots[voterId] = ballot.toArray();
    });
    const voters: Record<string, WorkshopVoter> = {};
    this.votingVoters.forEach((voter, voterId) => {
      voters[voterId] = voter;
    });

    this.doc.transact(() => {
      const objectIds = new Set<string>();
      for (const ids of Object.values(ballots)) {
        for (const objectId of ids) objectIds.add(objectId);
      }
      for (const objectId of objectIds) {
        const m = this.objects.get(objectId);
        if (!m) continue;
        const existing = m.get('votes');
        const next = mergeBallotsOntoObjectVotes(
          existing,
          votersForObjectId(ballots, voters, objectId),
          session.id,
          anonymous,
          revealedAt,
        );
        m.set('votes', next);
      }
      this.workshop.set('voting', { ...session, status: 'revealed', revealedAt });
    }, TX_ORIGIN_LOCAL);
  }

  /** Drop session maps. Revealed tallies already live on object.votes. */
  clearVotingSession(): void {
    const session = this.getVotingSession();
    if (!session || (session.startedBy !== this.identity.id && !this.isOwner())) return;
    this.doc.transact(() => {
      this.workshop.delete('voting');
      this.votingBallots.clear();
      this.votingVoters.clear();
    }, TX_ORIGIN_LOCAL);
  }

  /** If a timed session expired, merge + reveal (any editor). */
  checkVotingDeadline(): void {
    const session = this.getVotingSession();
    if (!session || session.status !== 'active' || !session.endsAt) return;
    if (Date.now() >= session.endsAt) this.revealVotingSession({ forceDeadline: true });
  }

  /** Shared room ACL (Docs-style view / edit). Missing fields = open edit for compat. */
  getRoomAccess(): RoomAccessState {
    const ownerId = typeof this.meta.get('ownerId') === 'string' ? (this.meta.get('ownerId') as string) : '';
    const rawLink = this.meta.get('linkAccess');
    const linkAccess: LinkAccess = rawLink === 'view' ? 'view' : 'edit';
    const editorsRaw = this.meta.get('editors');
    const editors = Array.isArray(editorsRaw)
      ? editorsRaw.filter((x): x is string => typeof x === 'string')
      : [];
    const pendingRaw = this.meta.get('pendingEditRequests');
    const pendingEditRequests: EditAccessRequest[] = Array.isArray(pendingRaw)
      ? pendingRaw
          .filter((r): r is EditAccessRequest => !!r && typeof r === 'object' && typeof (r as EditAccessRequest).id === 'string')
          .map((r) => ({
            id: r.id,
            name: typeof r.name === 'string' ? r.name : 'Someone',
            color: typeof r.color === 'string' ? r.color : GRAVITY.link,
            at: typeof r.at === 'number' ? r.at : 0,
          }))
      : [];
    return { ownerId, linkAccess, editors, pendingEditRequests };
  }

  canEdit(userId: string = this.identity.id): boolean {
    return deriveCanEdit(this.getRoomAccess(), userId);
  }

  isOwner(userId: string = this.identity.id): boolean {
    const { ownerId } = this.getRoomAccess();
    return !!ownerId && ownerId === userId;
  }

  /** First synced client becomes owner when unset (existing rooms keep open edit until then). */
  seedRoomAccessIfNeeded(): void {
    const owner = this.meta.get('ownerId');
    if (typeof owner === 'string' && owner) return;
    this.doc.transact(() => {
      if (typeof this.meta.get('ownerId') === 'string' && this.meta.get('ownerId')) return;
      this.meta.set('ownerId', this.identity.id);
      if (this.meta.get('linkAccess') !== 'view' && this.meta.get('linkAccess') !== 'edit') {
        this.meta.set('linkAccess', 'edit');
      }
      if (!Array.isArray(this.meta.get('editors'))) this.meta.set('editors', []);
      if (!Array.isArray(this.meta.get('pendingEditRequests'))) this.meta.set('pendingEditRequests', []);
    }, TX_ORIGIN_LOCAL);
  }

  setLinkAccess(mode: LinkAccess): void {
    if (!this.isOwner()) return;
    this.doc.transact(() => {
      this.meta.set('linkAccess', mode);
      if (mode === 'edit') {
        // Open link-edit clears the queue — everyone can edit again.
        this.meta.set('pendingEditRequests', []);
      }
    }, TX_ORIGIN_LOCAL);
  }

  requestEditAccess(): void {
    const access = this.getRoomAccess();
    if (this.canEdit() || !access.ownerId) return;
    if (access.pendingEditRequests.some((r) => r.id === this.identity.id)) return;
    const next: EditAccessRequest[] = [
      ...access.pendingEditRequests,
      {
        id: this.identity.id,
        name: this.identity.name,
        color: this.identity.color,
        at: Date.now(),
      },
    ];
    this.doc.transact(() => {
      this.meta.set('pendingEditRequests', next);
    }, TX_ORIGIN_LOCAL);
  }

  approveEditRequest(userId: string): void {
    if (!this.isOwner()) return;
    const access = this.getRoomAccess();
    const editors = access.editors.includes(userId) ? access.editors : [...access.editors, userId];
    const pending = access.pendingEditRequests.filter((r) => r.id !== userId);
    this.doc.transact(() => {
      this.meta.set('editors', editors);
      this.meta.set('pendingEditRequests', pending);
    }, TX_ORIGIN_LOCAL);
  }

  denyEditRequest(userId: string): void {
    if (!this.isOwner()) return;
    const pending = this.getRoomAccess().pendingEditRequests.filter((r) => r.id !== userId);
    this.doc.transact(() => {
      this.meta.set('pendingEditRequests', pending);
    }, TX_ORIGIN_LOCAL);
  }

  revokeEditor(userId: string): void {
    if (!this.isOwner() || userId === this.identity.id) return;
    const editors = this.getRoomAccess().editors.filter((id) => id !== userId);
    this.doc.transact(() => {
      this.meta.set('editors', editors);
    }, TX_ORIGIN_LOCAL);
  }

  setPresence(partial: Partial<AwarenessState>): void {
    const current = (this.awareness.getLocalState() ?? {}) as AwarenessState;
    this.awareness.setLocalState({ ...current, ...partial });
  }

  destroy(): void {
    this.provider.destroy();
    this.persistence.destroy();
    this.doc.destroy();
    logger.info('Left room', this.roomId);
  }
}
