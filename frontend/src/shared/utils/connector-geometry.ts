import type { ConnectorStyle } from '../constants/connector.constants';

/** Flat Konva points [x1,y1,x2,y2,...] between two object centers. */
export function connectorPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: ConnectorStyle = 'straight',
): number[] {
  switch (style) {
    case 'elbow':
      return elbowPoints(x1, y1, x2, y2);
    case 'curved':
      return curvedPoints(x1, y1, x2, y2);
    case 'polyline':
      return polylinePoints(x1, y1, x2, y2);
    case 'straight':
    default:
      return [x1, y1, x2, y2];
  }
}

function elbowPoints(x1: number, y1: number, x2: number, y2: number): number[] {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  if (dx >= dy) {
    const midX = (x1 + x2) / 2;
    return [x1, y1, midX, y1, midX, y2, x2, y2];
  }
  const midY = (y1 + y2) / 2;
  return [x1, y1, x1, midY, x2, midY, x2, y2];
}

/** Cubic-ish curve sampled for Konva Line/Arrow. */
function curvedPoints(x1: number, y1: number, x2: number, y2: number): number[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const offset = Math.min(120, dist * 0.35);
  // Control points offset perpendicular to the chord for a smooth S-curve.
  const nx = -dy / dist;
  const ny = dx / dist;
  const cx1 = x1 + dx * 0.35 + nx * offset;
  const cy1 = y1 + dy * 0.35 + ny * offset;
  const cx2 = x1 + dx * 0.65 - nx * offset;
  const cy2 = y1 + dy * 0.65 - ny * offset;

  const steps = 18;
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x =
      u * u * u * x1 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x2;
    const y =
      u * u * u * y1 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y2;
    pts.push(x, y);
  }
  return pts;
}

/** Orthogonal multi-bend route (flowchart-style). */
function polylinePoints(x1: number, y1: number, x2: number, y2: number): number[] {
  const gap = Math.max(28, Math.min(80, Math.abs(x2 - x1) * 0.25));
  const outX = x1 + (x2 >= x1 ? gap : -gap);
  const inX = x2 + (x2 >= x1 ? -gap : gap);
  const midY = (y1 + y2) / 2;
  return [x1, y1, outX, y1, outX, midY, inX, midY, inX, y2, x2, y2];
}
