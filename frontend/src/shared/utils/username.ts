import { nanoid } from 'nanoid';

/** Device-local usernames seen on this browser (any tab). Used to avoid clashes. */
const USED_USERNAMES_KEY = 'gravity.usernames';
const MAX_TRACKED = 48;

/** Short username stems for auto-generated guest names. */
const USERNAME_STEMS = [
  'Orbit',
  'Nova',
  'Quark',
  'Photon',
  'Nebula',
  'Comet',
  'Pulsar',
  'Aster',
  'Flux',
  'Drift',
  'Mass',
  'Spark',
  'Ripple',
  'Vector',
  'Pixel',
  'Canvas',
  'Sticky',
  'Frame',
  'Loom',
  'Atlas',
  'Bolt',
  'Echo',
  'Glow',
  'Halo',
  'Ion',
  'Jet',
  'Knot',
  'Lumen',
  'Mesa',
  'Nimbus',
] as const;

/** Trim + lower-case for device clash checks (not the display name). */
export function normalizeUsername(name: string): string {
  return name.trim().toLowerCase();
}

function readUsed(): string[] {
  try {
    const raw = localStorage.getItem(USED_USERNAMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === 'string')
      .map(normalizeUsername)
      .filter((x) => x.length >= 2);
  } catch {
    return [];
  }
}

function writeUsed(names: string[]): void {
  try {
    localStorage.setItem(USED_USERNAMES_KEY, JSON.stringify(names.slice(0, MAX_TRACKED)));
  } catch {
    /* private mode */
  }
}

/** Usernames already used on this device (normalized). */
export function listDeviceUsernames(): string[] {
  return readUsed();
}

/** Remember a username so later auto-generate skips it. */
export function rememberDeviceUsername(name: string): void {
  const n = normalizeUsername(name);
  if (n.length < 2) return;
  const next = [n, ...readUsed().filter((x) => x !== n)].slice(0, MAX_TRACKED);
  writeUsed(next);
}

/**
 * Pick a username that does not collide with others already used on this device.
 * Pass `avoid` for the current draft so Suggest always offers something new.
 */
export function generateUsername(options?: { avoid?: string | string[] }): string {
  const taken = new Set(listDeviceUsernames());
  const extra = options?.avoid;
  if (typeof extra === 'string' && extra.trim()) taken.add(normalizeUsername(extra));
  else if (Array.isArray(extra)) {
    for (const a of extra) {
      if (a.trim()) taken.add(normalizeUsername(a));
    }
  }

  const stems = [...USERNAME_STEMS];
  for (let i = stems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = stems[i]!;
    stems[i] = stems[j]!;
    stems[j] = tmp;
  }

  for (const stem of stems) {
    if (!taken.has(normalizeUsername(stem))) return stem;
    for (let n = 2; n <= 99; n++) {
      const candidate = `${stem}${n}`;
      if (!taken.has(normalizeUsername(candidate))) return candidate;
    }
  }

  return `Guest${nanoid(4)}`;
}
