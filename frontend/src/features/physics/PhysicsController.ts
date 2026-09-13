import Matter from 'matter-js';
import type * as Y from 'yjs';
import { PHYSICS, TX_ORIGIN_PHYSICS } from '../../shared/constants/physics.constants';
import { logger } from '../../shared/logging/logger';
import type { AwarenessState, CanvasObject } from '../../shared/types';
import { voteCount } from '../../shared/utils/votes';
import { useViewStore } from '../../stores/view.store';
import type { RoomConnection } from '../collaboration/RoomConnection';

/**
 * Matter.js integration with a single-writer design:
 *
 * Every client maintains bodies for physics-enabled objects, but only the
 * elected HOST steps the engine and publishes positions to Yjs using
 * TX_ORIGIN_PHYSICS. Attract/repel/wind/shake come from awareness; magnets
 * and archive wells are durable board objects; vote count scales mass.
 */
export class PhysicsController {
  private engine = Matter.Engine.create({ enableSleeping: true });
  private bodies = new Map<string, Matter.Body>();
  private sizes = new Map<string, { w: number; h: number }>();
  private ropes = new Map<string, Matter.Constraint>();
  private voteMass = new Map<string, number>();
  private isHost = false;
  private boardGravity = false;
  private floor: Matter.Body | null = null;
  private lastSync = 0;
  private readonly tickTimer: number;
  private readonly observer: (events: Y.YEvent<Y.Map<unknown>>[], txn: Y.Transaction) => void;

  constructor(private readonly conn: RoomConnection) {
    this.engine.gravity.x = 0;
    this.engine.gravity.y = 0;

    this.observer = (events, txn) => {
      // Skip host publishes so we do not rebuild bodies from our own physics writes (echo loop).
      if (txn.origin === TX_ORIGIN_PHYSICS) return;
      const ids = new Set<string>();
      for (const e of events) {
        if (e.target === this.conn.objects) {
          e.changes.keys.forEach((_change, key) => ids.add(key));
        } else if (typeof e.path[0] === 'string') {
          ids.add(e.path[0]);
        }
      }
      ids.forEach((id) => this.reconcile(id));
    };

    this.conn.objects.observeDeep(this.observer);
    this.rebuild();
    this.tickTimer = window.setInterval(() => this.tick(), 1000 / PHYSICS.TICK_HZ);
    logger.debug('Physics controller started');
  }

  /** Only the elected host steps the engine and publishes body positions to Yjs. */
  setHost(isHost: boolean): void {
    if (isHost && !this.isHost) this.rebuild();
    this.isHost = isHost;
  }

  /** Toggle Matter `gravity.y` and a floor body used as a ground plane. */
  setBoardGravity(on: boolean): void {
    this.boardGravity = on;
    this.engine.gravity.y = on ? PHYSICS.BOARD_GRAVITY_Y : 0;
    if (on) {
      this.ensureFloor();
      this.bodies.forEach((b) => Matter.Sleeping.set(b, false));
    } else if (this.floor) {
      Matter.Composite.remove(this.engine.world, this.floor);
      this.floor = null;
    }
  }

  private ensureFloor(): void {
    if (this.floor) Matter.Composite.remove(this.engine.world, this.floor);
    const { x, y, scale } = useViewStore.getState();
    const worldBottom = (-y + window.innerHeight) / scale + PHYSICS.FLOOR_MARGIN;
    const worldCenterX = (-x + window.innerWidth / 2) / scale;
    this.floor = Matter.Bodies.rectangle(worldCenterX, worldBottom, 20000, 40, {
      isStatic: true,
      label: '__floor',
    });
    Matter.Composite.add(this.engine.world, this.floor);
  }

  destroy(): void {
    clearInterval(this.tickTimer);
    this.conn.objects.unobserveDeep(this.observer);
    Matter.Engine.clear(this.engine);
    this.bodies.clear();
    this.sizes.clear();
    this.ropes.clear();
    this.voteMass.clear();
    this.floor = null;
    logger.debug('Physics controller stopped');
  }

  private rebuild(): void {
    Matter.Composite.clear(this.engine.world, false);
    this.bodies.clear();
    this.sizes.clear();
    this.ropes.clear();
    this.voteMass.clear();
    this.floor = null;
    for (const obj of Object.values(this.conn.getAllObjects())) {
      if (obj.physics && !obj.archived && obj.role !== 'magnet' && obj.role !== 'archiveWell') {
        this.addBody(obj);
      }
    }
    for (const obj of Object.values(this.conn.getAllObjects())) {
      if (obj.type === 'rope') this.reconcileRope(obj.id);
    }
    if (this.boardGravity) this.ensureFloor();
  }

  /** Vote count scales body mass (`VOTE_MASS_SCALE`, capped by `MAX_VOTE_MASS_MULT`). */
  private densityFor(o: CanvasObject): number {
    const votes = voteCount(o.votes);
    const mult = Math.min(PHYSICS.MAX_VOTE_MASS_MULT, 1 + votes * PHYSICS.VOTE_MASS_SCALE);
    return PHYSICS.BASE_DENSITY * mult;
  }

  private addBody(o: CanvasObject): void {
    const cx = o.x + o.width / 2;
    const cy = o.y + o.height / 2;
    const opts: Matter.IChamferableBodyDefinition = {
      frictionAir: PHYSICS.FRICTION_AIR,
      restitution: PHYSICS.RESTITUTION,
      angle: (o.rotation * Math.PI) / 180,
      label: o.id,
      isStatic: !!o.locked,
      density: this.densityFor(o),
    };
    const body =
      o.type === 'ellipse'
        ? Matter.Bodies.circle(cx, cy, (o.width + o.height) / 4, opts)
        : Matter.Bodies.rectangle(cx, cy, o.width, o.height, opts);
    Matter.Composite.add(this.engine.world, body);
    this.bodies.set(o.id, body);
    this.sizes.set(o.id, { w: o.width, h: o.height });
    this.voteMass.set(o.id, voteCount(o.votes));
  }

  private removeBody(id: string): void {
    const body = this.bodies.get(id);
    if (!body) return;
    Matter.Composite.remove(this.engine.world, body);
    this.bodies.delete(id);
    this.sizes.delete(id);
    this.voteMass.delete(id);
  }

  private reconcile(id: string): void {
    const o = this.conn.getObject(id);
    if (o?.type === 'rope') {
      this.reconcileRope(id);
      return;
    }
    if (
      !o ||
      !o.physics ||
      o.archived ||
      o.role === 'magnet' ||
      o.role === 'archiveWell'
    ) {
      this.removeBody(id);
      this.removeRopesTouching(id);
      return;
    }

    const size = this.sizes.get(id);
    if (size && (Math.abs(size.w - o.width) > 1 || Math.abs(size.h - o.height) > 1)) {
      this.removeBody(id);
    }

    let body = this.bodies.get(id);
    if (!body) {
      this.addBody(o);
      body = this.bodies.get(id)!;
    } else {
      Matter.Body.setPosition(body, { x: o.x + o.width / 2, y: o.y + o.height / 2 });
      Matter.Body.setAngle(body, (o.rotation * Math.PI) / 180);
      Matter.Body.setVelocity(body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(body, 0);
      Matter.Body.setStatic(body, !!o.locked);
      const votes = voteCount(o.votes);
      if (this.voteMass.get(id) !== votes) {
        Matter.Body.setDensity(body, this.densityFor(o));
        this.voteMass.set(id, votes);
      }
    }

    if (o.impulse && this.isHost) {
      if (Date.now() - o.impulse.t < 5000) {
        Matter.Sleeping.set(body, false);
        Matter.Body.setVelocity(body, { x: o.impulse.vx, y: o.impulse.vy });
      }
      this.conn.updateObject(id, { impulse: null }, TX_ORIGIN_PHYSICS);
    }
  }

  private reconcileRope(id: string): void {
    const existing = this.ropes.get(id);
    if (existing) {
      Matter.Composite.remove(this.engine.world, existing);
      this.ropes.delete(id);
    }
    const rope = this.conn.getObject(id);
    if (!rope || rope.type !== 'rope' || !rope.fromId || !rope.toId) return;
    const a = this.bodies.get(rope.fromId);
    const b = this.bodies.get(rope.toId);
    if (!a || !b) return;
    const constraint = Matter.Constraint.create({
      bodyA: a,
      bodyB: b,
      stiffness: 0.08,
      damping: 0.05,
      length: Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y),
      label: id,
    });
    Matter.Composite.add(this.engine.world, constraint);
    this.ropes.set(id, constraint);
  }

  private removeRopesTouching(objectId: string): void {
    for (const [ropeId, constraint] of [...this.ropes.entries()]) {
      const rope = this.conn.getObject(ropeId);
      if (!rope || rope.fromId === objectId || rope.toId === objectId || !this.conn.getObject(ropeId)) {
        Matter.Composite.remove(this.engine.world, constraint);
        this.ropes.delete(ropeId);
      }
    }
  }

  private tick(): void {
    if (!this.isHost) return;
    this.applyAttractors();
    this.applyWind();
    this.applyShake();
    this.applyMagnets();
    this.applyArchiveWells();
    Matter.Engine.update(this.engine, 1000 / PHYSICS.TICK_HZ);
    this.clampVelocities();
    this.publish();
  }

  private applyAttractors(): void {
    const states = this.conn.awareness.getStates() as Map<number, AwarenessState>;
    states.forEach((state) => {
      const a = state?.attract;
      if (!a) return;
      this.bodies.forEach((body) => {
        if (body.isStatic) return;
        const dx = a.x - body.position.x;
        const dy = a.y - body.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist < PHYSICS.ATTRACT_DEADZONE || dist > PHYSICS.ATTRACT_RADIUS) return;
        const f = PHYSICS.ATTRACT_FORCE * body.mass * a.dir;
        Matter.Sleeping.set(body, false);
        Matter.Body.applyForce(body, body.position, { x: (dx / dist) * f, y: (dy / dist) * f });
      });
    });
  }

  private applyWind(): void {
    const states = this.conn.awareness.getStates() as Map<number, AwarenessState>;
    states.forEach((state) => {
      const w = state?.wind;
      if (!w) return;
      const speed = Math.hypot(w.vx, w.vy);
      if (speed < 0.2) return;
      const ux = w.vx / speed;
      const uy = w.vy / speed;
      this.bodies.forEach((body) => {
        if (body.isStatic) return;
        const dist = Math.hypot(w.x - body.position.x, w.y - body.position.y);
        if (dist > PHYSICS.WIND_RADIUS) return;
        const falloff = 1 - dist / PHYSICS.WIND_RADIUS;
        const f = PHYSICS.WIND_FORCE * body.mass * falloff * Math.min(2.5, speed / 8);
        Matter.Sleeping.set(body, false);
        Matter.Body.applyForce(body, body.position, { x: ux * f, y: uy * f });
      });
    });
  }

  private applyShake(): void {
    const now = Date.now();
    const states = this.conn.awareness.getStates() as Map<number, AwarenessState>;
    states.forEach((state) => {
      const s = state?.shake;
      if (!s || now - s.at > PHYSICS.SHAKE_DURATION_MS) return;
      this.bodies.forEach((body) => {
        if (body.isStatic) return;
        const dist = Math.hypot(s.x - body.position.x, s.y - body.position.y);
        if (dist > PHYSICS.SHAKE_RADIUS) return;
        const falloff = 1 - dist / PHYSICS.SHAKE_RADIUS;
        const mag = PHYSICS.SHAKE_SPEED * s.strength * falloff;
        Matter.Sleeping.set(body, false);
        Matter.Body.setVelocity(body, {
          x: (Math.random() * 2 - 1) * mag,
          y: (Math.random() * 2 - 1) * mag,
        });
      });
    });
  }

  private applyMagnets(): void {
    const magnets = Object.values(this.conn.getAllObjects()).filter((o) => o.role === 'magnet' && !o.archived);
    if (magnets.length === 0) return;
    for (const magnet of magnets) {
      const mx = magnet.x + magnet.width / 2;
      const my = magnet.y + magnet.height / 2;
      this.bodies.forEach((body, id) => {
        if (body.isStatic || id === magnet.id) return;
        const dx = mx - body.position.x;
        const dy = my - body.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist < PHYSICS.MAGNET_DEADZONE || dist > PHYSICS.MAGNET_RADIUS) return;
        const f = PHYSICS.MAGNET_FORCE * body.mass * (1 - dist / PHYSICS.MAGNET_RADIUS);
        Matter.Sleeping.set(body, false);
        Matter.Body.applyForce(body, body.position, { x: (dx / dist) * f, y: (dy / dist) * f });
      });
    }
  }

  private applyArchiveWells(): void {
    const wells = Object.values(this.conn.getAllObjects()).filter(
      (o) => o.role === 'archiveWell' && !o.archived,
    );
    if (wells.length === 0) return;

    for (const well of wells) {
      const cx = well.x + well.width / 2;
      const cy = well.y + well.height / 2;
      const radius = Math.max(well.width, well.height) / 2 + PHYSICS.ARCHIVE_RADIUS * 0.15;

      for (const [id, body] of [...this.bodies.entries()]) {
        if (body.isStatic) continue;
        const dx = cx - body.position.x;
        const dy = cy - body.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) continue;

        if (dist < PHYSICS.ARCHIVE_SWALLOW_DIST) {
          const size = this.sizes.get(id);
          this.conn.updateObject(
            id,
            {
              x: cx - (size?.w ?? 40) / 2,
              y: cy - (size?.h ?? 40) / 2,
              rotation: 0,
              physics: false,
              impulse: null,
              archived: true,
              opacity: 0.55,
            },
            TX_ORIGIN_PHYSICS,
          );
          this.removeBody(id);
          continue;
        }

        const f = PHYSICS.ARCHIVE_FORCE * body.mass * (1 - dist / radius);
        Matter.Sleeping.set(body, false);
        Matter.Body.applyForce(body, body.position, { x: (dx / dist) * f, y: (dy / dist) * f });
      }
    }
  }

  private clampVelocities(): void {
    this.bodies.forEach((body) => {
      if (body.speed > PHYSICS.MAX_SPEED) {
        const k = PHYSICS.MAX_SPEED / body.speed;
        Matter.Body.setVelocity(body, { x: body.velocity.x * k, y: body.velocity.y * k });
      }
    });
  }

  private publish(): void {
    const now = performance.now();
    if (now - this.lastSync < 1000 / PHYSICS.SYNC_HZ) return;
    this.lastSync = now;

    this.bodies.forEach((body, id) => {
      if (body.isSleeping || body.isStatic) return;
      if (body.speed < 0.05 && Math.abs(body.angularVelocity) < 0.002) return;
      const size = this.sizes.get(id);
      if (!size) return;
      this.conn.updateObject(
        id,
        {
          x: body.position.x - size.w / 2,
          y: body.position.y - size.h / 2,
          rotation: (body.angle * 180) / Math.PI,
        },
        TX_ORIGIN_PHYSICS,
      );
    });
  }
}
