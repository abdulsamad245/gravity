import { APP_NAME } from '../constants/app.constants';

/**
 * Best-effort desktop notification. Never throws; silently no-ops when the
 * Notification API is missing, permission is denied, or the tab is focused
 * (callers still show an in-app toast for that case).
 */
export async function notifyWhenDone(options: {
  title: string;
  body: string;
  /** When true, skip if the document is visible (user already sees the toast). */
  onlyWhenHidden?: boolean;
}): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (options.onlyWhenHidden !== false && document.visibilityState === 'visible') return;

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return;

    const n = new Notification(options.title, {
      body: options.body,
      tag: `${APP_NAME.toLowerCase()}-export`,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Permission prompts / restricted iframes can reject; ignore.
  }
}
