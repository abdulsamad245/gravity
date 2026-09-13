/**
 * Soft Install card dismiss rules.
 * Closing Orbit, menus, or the product tour must not snooze the prompt.
 */

export interface InstallDismissChrome {
  tourActive: boolean;
  spotlightActive: boolean;
  orbitOpen: boolean;
  modalOpen: boolean;
}

export function readInstallDismissChrome(
  root: Pick<Document, 'body' | 'querySelector'> = document,
): InstallDismissChrome {
  return {
    tourActive: root.body.classList.contains('gravity-tour-active'),
    spotlightActive: root.body.classList.contains('gravity-spotlight-active'),
    orbitOpen: !!root.querySelector('.room.sidekick-open'),
    modalOpen: !!root.querySelector('.modal-backdrop'),
  };
}

function chromeBlocksDismiss(chrome: InstallDismissChrome): boolean {
  return chrome.tourActive || chrome.spotlightActive;
}

/** Escape should not snooze Install while Orbit, a modal, or the tour owns the UI. */
export function shouldIgnoreInstallEscape(chrome: InstallDismissChrome): boolean {
  if (chromeBlocksDismiss(chrome)) return true;
  if (chrome.orbitOpen || chrome.modalOpen) return true;
  return false;
}

/**
 * Outside-click dismiss only for the board canvas (`#canvas-main`).
 * Clicks on Orbit, toolbar, More menu, dialogs, etc. are ignored.
 */
export function shouldIgnoreInstallOutsideClick(
  target: EventTarget | null,
  chrome: InstallDismissChrome,
): boolean {
  if (chromeBlocksDismiss(chrome)) return true;
  if (!target || typeof (target as Element).closest !== 'function') return true;
  return !(target as Element).closest('#canvas-main');
}
