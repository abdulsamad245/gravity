/** Board chart kinds — mirrors common whiteboard chart pickers. */
export const CHART_KINDS = [
  'clusteredColumns',
  'stackedColumns',
  'clusteredBars',
  'stackedBars',
  'percentColumns',
  'percentBars',
  'combination',
  'line',
  'area',
  'stackedArea',
  'pie',
  'donut',
  'rose',
  'scatter',
  'radar',
] as const;

export type ChartKind = (typeof CHART_KINDS)[number];

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartDefinition {
  kind: ChartKind;
  label: string;
  category: 'Bar Chart' | 'Line Chart' | 'Pie Chart' | 'Others';
}

export const CHART_DEFINITIONS: ChartDefinition[] = [
  { kind: 'clusteredColumns', label: 'Clustered columns', category: 'Bar Chart' },
  { kind: 'stackedColumns', label: 'Stacked columns', category: 'Bar Chart' },
  { kind: 'clusteredBars', label: 'Clustered bars', category: 'Bar Chart' },
  { kind: 'stackedBars', label: 'Stacked bars', category: 'Bar Chart' },
  { kind: 'percentColumns', label: '100% stacked columns', category: 'Bar Chart' },
  { kind: 'percentBars', label: '100% stacked bars', category: 'Bar Chart' },
  { kind: 'combination', label: 'Combination chart', category: 'Bar Chart' },
  { kind: 'line', label: 'Line chart', category: 'Line Chart' },
  { kind: 'area', label: 'Basic area', category: 'Line Chart' },
  { kind: 'stackedArea', label: 'Stacked area', category: 'Line Chart' },
  { kind: 'pie', label: 'Pie chart', category: 'Pie Chart' },
  { kind: 'donut', label: 'Donut chart', category: 'Pie Chart' },
  { kind: 'rose', label: 'Rose chart', category: 'Pie Chart' },
  { kind: 'scatter', label: 'Basic scatter plot', category: 'Others' },
  { kind: 'radar', label: 'Radar chart', category: 'Others' },
];

export const CHART_PALETTE = ['#6c8cff', '#a78bfa', '#38bdf8', '#f472b6', '#fbbf24', '#34d399'] as const;

export const DEFAULT_CHART_CATEGORIES = ['A', 'B', 'C', 'D'];

export const DEFAULT_CHART_SERIES: ChartSeries[] = [
  { name: 'Series 1', values: [4, 7, 5, 9] },
  { name: 'Series 2', values: [3, 5, 8, 6] },
];

export function isChartKind(value: unknown): value is ChartKind {
  return typeof value === 'string' && (CHART_KINDS as readonly string[]).includes(value);
}

export function chartLabel(kind: ChartKind): string {
  return CHART_DEFINITIONS.find((d) => d.kind === kind)?.label ?? 'Chart';
}
