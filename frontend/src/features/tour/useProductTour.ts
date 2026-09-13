import { useEffect } from 'react';
import { PRODUCT_TOUR_START_DELAY_MS } from './tour.constants';
import {
  destroyProductTour,
  hasCompletedProductTour,
  isProductTourActive,
  startProductTour,
} from './product-tour';

interface Options {
  /** Chrome is on screen and the user can interact with the board. */
  enabled: boolean;
  /** Board-start modal is gone (dismissed or not shown). */
  boardReady: boolean;
  /** Another modal/panel would fight the spotlight. */
  blocked: boolean;
}

/**
 * Auto-starts the first-run product tour once the room chrome is ready.
 * Manual restarts use `startProductTour({ force: true })` from the More menu.
 */
export function useProductTour({ enabled, boardReady, blocked }: Options): void {
  useEffect(() => {
    if (!enabled) {
      if (isProductTourActive()) destroyProductTour();
      return;
    }
    if (!boardReady || blocked) return;
    if (hasCompletedProductTour() || isProductTourActive()) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || hasCompletedProductTour() || isProductTourActive()) return;
      startProductTour();
    }, PRODUCT_TOUR_START_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, boardReady, blocked]);

  useEffect(() => {
    return () => {
      if (isProductTourActive()) destroyProductTour();
    };
  }, []);
}
