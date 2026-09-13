/** localStorage key for install-prompt snooze (timestamp ms). */
export const PWA_INSTALL_DISMISS_KEY = 'gravity.pwa.installDismissedAt';

/** How long to hide the install card after Not now (14 days). */
export const PWA_INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

/** Wait before offering install so first paint and room chrome settle. */
export const PWA_INSTALL_SHOW_DELAY_MS = 5000;
