import type { ReactNode } from 'react';
import { Arc, Circle, Group, Line, Rect, Text } from 'react-konva';
import {
  CHART_PALETTE,
  DEFAULT_CHART_CATEGORIES,
  DEFAULT_CHART_SERIES,
  chartLabel,
  type ChartKind,
  type ChartSeries,
} from '../../../shared/constants/chart.constants';
import type { CanvasObject } from '../../../shared/types';

interface Props {
  obj: CanvasObject;
  halfW: number;
  halfH: number;
}

function seriesOf(obj: CanvasObject): ChartSeries[] {
  if (obj.chartSeries?.length) return obj.chartSeries;
  return DEFAULT_CHART_SERIES;
}

function catsOf(obj: CanvasObject): string[] {
  if (obj.chartCategories?.length) return obj.chartCategories;
  return DEFAULT_CHART_CATEGORIES;
}

function maxVal(series: ChartSeries[]): number {
  let m = 1;
  for (const s of series) for (const v of s.values) if (v > m) m = v;
  return m;
}

function colTotals(series: ChartSeries[], n: number): number[] {
  const totals = Array.from({ length: n }, () => 0);
  for (const s of series) {
    for (let i = 0; i < n; i++) totals[i] += s.values[i] ?? 0;
  }
  return totals.map((t) => (t <= 0 ? 1 : t));
}

export function ChartContent({ obj, halfW, halfH }: Props) {
  const kind = (obj.chartKind ?? 'clusteredColumns') as ChartKind;
  const pad = 14;
  const header = 22;
  const w = obj.width;
  const h = obj.height;
  const plotX = -halfW + pad;
  const plotY = -halfH + header + 8;
  const plotW = w - pad * 2;
  const plotH = h - header - pad - 8;
  const series = seriesOf(obj);
  const cats = catsOf(obj);
  const n = Math.max(cats.length, ...series.map((s) => s.values.length), 1);

  return (
    <Group listening={false}>
      <Rect
        x={-halfW}
        y={-halfH}
        width={w}
        height={h}
        fill={obj.fill || '#16181f'}
        stroke={obj.stroke ?? '#3d4454'}
        strokeWidth={obj.strokeWidth ?? 1.5}
        cornerRadius={12}
      />
      <Text
        x={-halfW + pad}
        y={-halfH + 8}
        width={w - pad * 2}
        text={obj.text || chartLabel(kind)}
        fontSize={12}
        fontStyle="bold"
        fontFamily="DM Sans, system-ui, sans-serif"
        fill={obj.textColor ?? '#e8eaed'}
        ellipsis
        wrap="none"
      />
      <Group x={plotX} y={plotY}>
        {renderPlot(kind, series, cats, n, plotW, Math.max(24, plotH))}
      </Group>
    </Group>
  );
}

function renderPlot(
  kind: ChartKind,
  series: ChartSeries[],
  cats: string[],
  n: number,
  w: number,
  h: number,
) {
  switch (kind) {
    case 'clusteredBars':
    case 'stackedBars':
    case 'percentBars':
      return renderBars(kind, series, n, w, h, true);
    case 'pie':
    case 'donut':
    case 'rose':
      return renderPie(kind, series, w, h);
    case 'line':
    case 'area':
    case 'stackedArea':
      return renderLineArea(kind, series, n, w, h);
    case 'scatter':
      return renderScatter(series, n, w, h);
    case 'radar':
      return renderRadar(series, n, w, h);
    case 'combination':
      return (
        <>
          {renderBars('clusteredColumns', series.slice(0, 1), n, w, h, false)}
          {renderLineArea('line', series.slice(1), n, w, h, false)}
        </>
      );
    case 'clusteredColumns':
    case 'stackedColumns':
    case 'percentColumns':
    default:
      return renderBars(kind, series, n, w, h, false);
  }
}

function renderBars(
  kind: ChartKind,
  series: ChartSeries[],
  n: number,
  w: number,
  h: number,
  horizontal: boolean,
) {
  const stacked = kind === 'stackedColumns' || kind === 'stackedBars';
  const percent = kind === 'percentColumns' || kind === 'percentBars';
  const clustered = !stacked && !percent;
  const max = percent ? 1 : maxVal(series);
  const totals = colTotals(series, n);
  const nodes: ReactNode[] = [];
  const gap = 6;
  const groupSize = horizontal ? (h - gap * (n + 1)) / n : (w - gap * (n + 1)) / n;

  for (let i = 0; i < n; i++) {
    let stack = 0;
    const clusterCount = clustered ? series.length : 1;
    const barSpan = clustered ? (groupSize - 4) / clusterCount : groupSize;

    series.forEach((s, si) => {
      const raw = s.values[i] ?? 0;
      const value = percent ? raw / totals[i] : raw;
      const color = CHART_PALETTE[si % CHART_PALETTE.length];
      if (horizontal) {
        const y = gap + i * (groupSize + gap) + (clustered ? si * barSpan : 0);
        const bw = (value / max) * (w - 8);
        const x = stacked || percent ? stack : 0;
        nodes.push(
          <Rect
            key={`${i}-${si}`}
            x={x}
            y={y}
            width={Math.max(1, bw)}
            height={Math.max(3, barSpan - 1)}
            fill={color}
            cornerRadius={2}
          />,
        );
        if (stacked || percent) stack += bw;
      } else {
        const x = gap + i * (groupSize + gap) + (clustered ? si * barSpan : 0);
        const bh = (value / max) * (h - 8);
        const y = h - bh - (stacked || percent ? stack : 0);
        nodes.push(
          <Rect
            key={`${i}-${si}`}
            x={x}
            y={y}
            width={Math.max(3, barSpan - 1)}
            height={Math.max(1, bh)}
            fill={color}
            cornerRadius={2}
          />,
        );
        if (stacked || percent) stack += bh;
      }
    });
  }
  return <>{nodes}</>;
}

function renderLineArea(
  kind: ChartKind,
  series: ChartSeries[],
  n: number,
  w: number,
  h: number,
  fillArea = true,
) {
  if (!series.length) return null;
  const max = maxVal(series);
  const stacked = kind === 'stackedArea';
  const area = kind === 'area' || stacked;
  const nodes: ReactNode[] = [];
  const stacks = Array.from({ length: n }, () => 0);

  series.forEach((s, si) => {
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = n <= 1 ? w / 2 : (i / (n - 1)) * w;
      const base = stacked ? stacks[i] : 0;
      const v = s.values[i] ?? 0;
      const y = h - ((base + v) / max) * (h - 6) - 2;
      pts.push(x, y);
      if (stacked) stacks[i] += v;
    }
    const color = CHART_PALETTE[si % CHART_PALETTE.length];
    if (area && fillArea && pts.length >= 4) {
      const fillPts = [...pts, w, h, 0, h];
      nodes.push(
        <Line
          key={`a-${si}`}
          points={fillPts}
          closed
          fill={color}
          opacity={0.28}
          strokeEnabled={false}
        />,
      );
    }
    nodes.push(
      <Line
        key={`l-${si}`}
        points={pts}
        stroke={color}
        strokeWidth={2.5}
        lineCap="round"
        lineJoin="round"
        tension={0.25}
      />,
    );
    for (let i = 0; i < pts.length; i += 2) {
      nodes.push(
        <Circle key={`d-${si}-${i}`} x={pts[i]} y={pts[i + 1]} radius={3} fill={color} />,
      );
    }
  });
  return <>{nodes}</>;
}

function renderPie(kind: ChartKind, series: ChartSeries[], w: number, h: number) {
  const values = series[0]?.values?.length
    ? series[0].values
    : series.flatMap((s) => s.values);
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 4;
  let angle = -90;
  const nodes: ReactNode[] = [];

  values.forEach((v, i) => {
    const sweep = (v / total) * 360;
    const radius = kind === 'rose' ? r * (0.45 + 0.55 * (v / Math.max(...values, 1))) : r;
    nodes.push(
      <Arc
        key={i}
        x={cx}
        y={cy}
        innerRadius={kind === 'donut' ? radius * 0.52 : 0}
        outerRadius={radius}
        angle={sweep}
        rotation={angle}
        fill={CHART_PALETTE[i % CHART_PALETTE.length]}
      />,
    );
    angle += sweep;
  });
  return <>{nodes}</>;
}

function renderScatter(series: ChartSeries[], n: number, w: number, h: number) {
  const max = maxVal(series);
  const nodes: ReactNode[] = [];
  series.forEach((s, si) => {
    const color = CHART_PALETTE[si % CHART_PALETTE.length];
    for (let i = 0; i < n; i++) {
      const x = n <= 1 ? w / 2 : (i / (n - 1)) * w;
      const y = h - ((s.values[i] ?? 0) / max) * (h - 10) - 4;
      nodes.push(<Circle key={`${si}-${i}`} x={x} y={y} radius={4} fill={color} opacity={0.9} />);
    }
  });
  return <>{nodes}</>;
}

function renderRadar(series: ChartSeries[], n: number, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 6;
  const max = maxVal(series);
  const axes = Math.max(3, n);
  const nodes: ReactNode[] = [];

  for (let ring = 1; ring <= 3; ring++) {
    const pts: number[] = [];
    for (let i = 0; i < axes; i++) {
      const a = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const rr = (r * ring) / 3;
      pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    nodes.push(
      <Line key={`ring-${ring}`} points={pts} closed stroke="#3d4454" strokeWidth={1} />,
    );
  }

  series.forEach((s, si) => {
    const pts: number[] = [];
    for (let i = 0; i < axes; i++) {
      const a = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const v = (s.values[i % s.values.length] ?? 0) / max;
      pts.push(cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v);
    }
    const color = CHART_PALETTE[si % CHART_PALETTE.length];
    nodes.push(
      <Line
        key={`radar-${si}`}
        points={pts}
        closed
        stroke={color}
        strokeWidth={2}
        fill={color}
        opacity={0.25}
      />,
    );
  });
  return <>{nodes}</>;
}
