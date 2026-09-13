/**
 * Physics tunables. Default: zero gravity, air friction, restitution.
 * Magnets, wind, shake, and archive wells add facilitation forces on top.
 */
export const PHYSICS = {
  TICK_HZ: 60,
  /** How often the host publishes awake body positions to Yjs. */
  SYNC_HZ: 30,
  /** Air friction: how quickly gliding objects slow down. */
  FRICTION_AIR: 0.03,
  /** Bounciness of collisions (0..1). */
  RESTITUTION: 0.85,
  /** Hard cap on body speed. Prevents runaway explosion states. */
  MAX_SPEED: 60,
  /** Attract/repel force scale (multiplied by body mass). */
  ATTRACT_FORCE: 0.0012,
  /** Attractors only act on bodies within this distance (world units). */
  ATTRACT_RADIUS: 2000,
  /** Skip attract/repel when closer than this (avoids jitter on top of the pointer). */
  ATTRACT_DEADZONE: 30,
  /** Pointer velocity → thrown velocity conversion (px/s → px/tick). */
  THROW_SCALE: 1 / 60,
  /** Minimum drag-release speed (px/s) that counts as a throw. */
  THROW_MIN_SPEED: 120,
  /** Board gravity when toggled on (Matter.js gravity.y). */
  BOARD_GRAVITY_Y: 0.8,
  /** Floor offset below the host viewport bottom when board gravity is on. */
  FLOOR_MARGIN: 40,

  /** Topic magnets: pull nearby physics objects into clusters. */
  MAGNET_FORCE: 0.0024,
  MAGNET_RADIUS: 520,
  MAGNET_DEADZONE: 36,
  /** Placed magnet chip size (world units). */
  MAGNET_SIZE: 88,

  /** Facilitator wind: directional push while the tool is held. */
  WIND_FORCE: 0.0018,
  WIND_RADIUS: 900,

  /** Shake burst: random velocities for a short window. */
  SHAKE_DURATION_MS: 450,
  SHAKE_SPEED: 14,
  SHAKE_RADIUS: 1600,

  /** Vote mass: each vote makes a body harder to shove. */
  BASE_DENSITY: 0.001,
  VOTE_MASS_SCALE: 0.45,
  MAX_VOTE_MASS_MULT: 4,

  /** Archive well: pull in, then park objects (physics off). */
  ARCHIVE_FORCE: 0.0035,
  ARCHIVE_RADIUS: 380,
  ARCHIVE_SWALLOW_DIST: 48,
  ARCHIVE_WELL_WIDTH: 280,
  ARCHIVE_WELL_HEIGHT: 200,

  /** Settle layout spacing (world units). */
  SETTLE_GAP: 24,
  SETTLE_COLS: 4,
} as const;

/** Yjs transaction origins — used to break echo loops between physics and sync. */
export const TX_ORIGIN_LOCAL = 'local';
export const TX_ORIGIN_PHYSICS = 'physics';
