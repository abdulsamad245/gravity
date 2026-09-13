import { create } from 'zustand';
import type { ReplayLogEntry } from '../shared/api/client';
import type { CanvasObject } from '../shared/types';

export type ReplayExportView = { x: number; y: number; scale: number };
export type ReplayExportSize = { w: number; h: number };

export type ReplayExportRequest = {
  entries: ReplayLogEntry[];
  roomId: string;
  view: ReplayExportView;
  size: ReplayExportSize;
};

type ReplayExportState = {
  /** Queued job waiting for the offscreen host stage. */
  request: ReplayExportRequest | null;
  /** Bumps when a new export is requested (host effect key; safe to clear `request`). */
  jobId: number;
  active: boolean;
  pct: number;
  panelOpen: boolean;
  roomId: string | null;
  frozenView: ReplayExportView;
  size: ReplayExportSize;
  frameObjects: Record<string, CanvasObject>;
  toast: string | null;

  requestExport: (req: ReplayExportRequest) => boolean;
  clearRequest: () => void;
  setActive: (active: boolean) => void;
  setPct: (pct: number) => void;
  setPanelOpen: (open: boolean) => void;
  setFrameObjects: (objects: Record<string, CanvasObject>) => void;
  setToast: (message: string | null) => void;
  /** Soft cancel signal for the running encode (host aborts MediaRecorder). */
  cancelRequested: boolean;
  requestCancel: () => void;
  clearCancel: () => void;
  reset: () => void;
};

const EMPTY_VIEW: ReplayExportView = { x: 0, y: 0, scale: 1 };
const EMPTY_SIZE: ReplayExportSize = { w: 1, h: 1 };

export const useReplayExportStore = create<ReplayExportState>((set, get) => ({
  request: null,
  jobId: 0,
  active: false,
  pct: 0,
  panelOpen: true,
  roomId: null,
  frozenView: EMPTY_VIEW,
  size: EMPTY_SIZE,
  frameObjects: {},
  toast: null,
  cancelRequested: false,

  requestExport: (req) => {
    if (get().active || get().request) return false;
    set((s) => ({
      request: req,
      jobId: s.jobId + 1,
      active: true,
      pct: 0,
      panelOpen: true,
      roomId: req.roomId,
      frozenView: req.view,
      size: req.size,
      frameObjects: {},
      cancelRequested: false,
      toast: 'Exporting video in the background. You can Exit replay and keep working.',
    }));
    return true;
  },

  clearRequest: () => set({ request: null }),

  setActive: (active) => set({ active }),
  setPct: (pct) => set({ pct }),
  setPanelOpen: (open) => set({ panelOpen: open }),
  setFrameObjects: (frameObjects) => set({ frameObjects }),
  setToast: (toast) => set({ toast }),
  requestCancel: () => set({ cancelRequested: true }),
  clearCancel: () => set({ cancelRequested: false }),

  reset: () =>
    set({
      request: null,
      active: false,
      pct: 0,
      panelOpen: true,
      roomId: null,
      frozenView: EMPTY_VIEW,
      size: EMPTY_SIZE,
      frameObjects: {},
      cancelRequested: false,
    }),
}));
