import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateUsername,
  listDeviceUsernames,
  normalizeUsername,
  rememberDeviceUsername,
} from './username';

function mockLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  });
}

beforeEach(() => {
  mockLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('username helpers', () => {
  it('normalizes for case-insensitive clash checks', () => {
    expect(normalizeUsername('  Ada  ')).toBe('ada');
  });

  it('remembers usernames on the device', () => {
    rememberDeviceUsername('Ada');
    rememberDeviceUsername('Grace');
    expect(listDeviceUsernames()).toEqual(['grace', 'ada']);
  });

  it('auto-generates a username that avoids device clashes', () => {
    const taken = ['Orbit', 'Nova', 'Quark', 'Photon', 'Nebula'];
    for (const name of taken) rememberDeviceUsername(name);

    for (let i = 0; i < 12; i++) {
      const next = generateUsername();
      expect(taken.map(normalizeUsername)).not.toContain(normalizeUsername(next));
      expect(next.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('avoids the current draft when regenerating', () => {
    rememberDeviceUsername('Orbit');
    for (let i = 0; i < 8; i++) {
      const next = generateUsername({ avoid: 'Orbit' });
      expect(normalizeUsername(next)).not.toBe('orbit');
    }
  });

  it('uses a numbered stem when every plain stem is taken', () => {
    const stems = [
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
    ];
    for (const stem of stems) rememberDeviceUsername(stem);
    const next = generateUsername();
    expect(next).toMatch(/^[A-Za-z]+[0-9]+$/);
  });
});
