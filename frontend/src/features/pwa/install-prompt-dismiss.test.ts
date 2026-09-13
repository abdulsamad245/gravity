import { describe, expect, it } from 'vitest';
import {
  shouldIgnoreInstallEscape,
  shouldIgnoreInstallOutsideClick,
  type InstallDismissChrome,
} from './install-prompt-dismiss';

const free: InstallDismissChrome = {
  tourActive: false,
  spotlightActive: false,
  orbitOpen: false,
  modalOpen: false,
};

describe('install-prompt-dismiss', () => {
  it('ignores outside clicks while the product tour or spotlight is active', () => {
    const canvas = { closest: (sel: string) => (sel === '#canvas-main' ? {} : null) } as unknown as Element;
    expect(shouldIgnoreInstallOutsideClick(canvas, { ...free, tourActive: true })).toBe(true);
    expect(shouldIgnoreInstallOutsideClick(canvas, { ...free, spotlightActive: true })).toBe(true);
  });

  it('only treats canvas clicks as dismissible outside clicks', () => {
    const canvas = { closest: (sel: string) => (sel === '#canvas-main' ? {} : null) } as unknown as Element;
    const orbitClose = { closest: () => null } as unknown as Element;
    expect(shouldIgnoreInstallOutsideClick(canvas, free)).toBe(false);
    expect(shouldIgnoreInstallOutsideClick(orbitClose, free)).toBe(true);
    expect(shouldIgnoreInstallOutsideClick(null, free)).toBe(true);
  });

  it('ignores Escape while Orbit, a modal, or the tour owns the UI', () => {
    expect(shouldIgnoreInstallEscape({ ...free, orbitOpen: true })).toBe(true);
    expect(shouldIgnoreInstallEscape({ ...free, modalOpen: true })).toBe(true);
    expect(shouldIgnoreInstallEscape({ ...free, tourActive: true })).toBe(true);
    expect(shouldIgnoreInstallEscape(free)).toBe(false);
  });
});
