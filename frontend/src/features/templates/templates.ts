import { nanoid } from 'nanoid';
import { OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import { DEFAULT_OUTLINE, GRAVITY, STICKY_COLORS } from '../../shared/constants/colors.constants';
import type { CanvasObject } from '../../shared/types';

export type TemplateCategory = 'brainstorm' | 'retro' | 'diagram' | 'kanban';

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  /** CSS preview key (unique mini-layout, no shared gradient art). */
  preview: string;
  build: (createdBy: string) => CanvasObject[];
}

function text(
  createdBy: string,
  opts: { x: number; y: number; text: string; z: number; width?: number; fontSize?: number },
): CanvasObject {
  return {
    id: nanoid(OBJECT_ID_LENGTH),
    type: 'text',
    x: opts.x,
    y: opts.y,
    width: opts.width ?? 240,
    height: 40,
    rotation: 0,
    fill: '#e9ecef',
    text: opts.text,
    fontSize: opts.fontSize ?? 26,
    z: opts.z,
    createdBy,
  };
}

function sticky(
  createdBy: string,
  opts: { x: number; y: number; fill: string; z: number; text?: string; w?: number; h?: number },
): CanvasObject {
  return {
    id: nanoid(OBJECT_ID_LENGTH),
    type: 'sticky',
    x: opts.x,
    y: opts.y,
    width: opts.w ?? 160,
    height: opts.h ?? 160,
    rotation: 0,
    fill: opts.fill,
    text: opts.text ?? '',
    z: opts.z,
    createdBy,
  };
}

function frame(
  createdBy: string,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
    z: number;
    fill?: string;
    stroke?: string;
  },
): CanvasObject {
  return {
    id: nanoid(OBJECT_ID_LENGTH),
    type: 'frame',
    x: opts.x,
    y: opts.y,
    width: opts.w,
    height: opts.h,
    rotation: 0,
    fill: opts.fill ?? 'rgba(61, 139, 253, 0.06)',
    stroke: opts.stroke ?? GRAVITY.link,
    strokeWidth: 2,
    text: opts.text,
    z: opts.z,
    createdBy,
  };
}

function shape(
  createdBy: string,
  opts: {
    type: 'rect' | 'ellipse' | 'diamond';
    x: number;
    y: number;
    w: number;
    h: number;
    fill: string;
    text: string;
    z: number;
  },
): CanvasObject {
  return {
    id: nanoid(OBJECT_ID_LENGTH),
    type: opts.type,
    x: opts.x,
    y: opts.y,
    width: opts.w,
    height: opts.h,
    rotation: 0,
    fill: opts.fill,
    text: opts.text,
    z: opts.z,
    createdBy,
  };
}

function connector(
  createdBy: string,
  fromId: string,
  toId: string,
  z: number,
): CanvasObject {
  return {
    id: nanoid(OBJECT_ID_LENGTH),
    type: 'connector',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rotation: 0,
    fill: DEFAULT_OUTLINE,
    stroke: DEFAULT_OUTLINE,
    strokeWidth: 2,
    fromId,
    toId,
    z,
    createdBy,
  };
}

/** Built-in starter board templates. */
export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'brainstorm',
    name: 'Brainstorm ring',
    description: 'Six stickies in a circle for fast divergence',
    category: 'brainstorm',
    preview: 'brainstorm',
    build: (createdBy) => {
      const notes = ['Idea A', 'Idea B', 'Idea C', 'Idea D', 'Idea E', 'Wild card'];
      return notes.map((t, i) => {
        const angle = (i / notes.length) * Math.PI * 2;
        return sticky(createdBy, {
          x: Math.cos(angle) * 220 - 80,
          y: Math.sin(angle) * 180 - 80,
          fill: STICKY_COLORS[i % STICKY_COLORS.length],
          text: t,
          z: i + 1,
        });
      });
    },
  },
  {
    id: 'affinity',
    name: 'Affinity map',
    description: 'Three clusters for grouping related ideas',
    category: 'brainstorm',
    preview: 'affinity',
    build: (createdBy) => {
      const groups = [
        { title: 'Theme A', x: -480, color: '#ffe8a3' },
        { title: 'Theme B', x: -40, color: '#ffc9e0' },
        { title: 'Theme C', x: 400, color: '#b8f5e8' },
      ];
      const out: CanvasObject[] = [];
      groups.forEach((g, i) => {
        out.push(text(createdBy, { x: g.x, y: -240, text: g.title, z: i + 1, width: 200 }));
        for (let n = 0; n < 3; n++) {
          out.push(
            sticky(createdBy, {
              x: g.x + (n % 2) * 170,
              y: -160 + Math.floor(n / 2) * 180,
              fill: g.color,
              z: 10 + i * 3 + n,
            }),
          );
        }
      });
      return out;
    },
  },
  {
    id: 'impact-effort',
    name: 'Impact / Effort',
    description: '2×2 matrix to prioritize what to build next',
    category: 'brainstorm',
    preview: 'matrix',
    build: (createdBy) => {
      const cells = [
        { title: 'Quick wins', x: -420, y: -280, fill: 'rgba(105, 219, 124, 0.12)', stroke: '#69db7c' },
        { title: 'Big bets', x: 40, y: -280, fill: 'rgba(61, 139, 253, 0.1)', stroke: GRAVITY.link },
        { title: 'Fill-ins', x: -420, y: 80, fill: 'rgba(255, 176, 32, 0.12)', stroke: '#ffb020' },
        { title: 'Time sinks', x: 40, y: 80, fill: 'rgba(255, 92, 106, 0.1)', stroke: GRAVITY.danger },
      ];
      const out: CanvasObject[] = [
        text(createdBy, { x: -200, y: -360, text: 'High impact ↑', z: 1, width: 280, fontSize: 20 }),
        text(createdBy, { x: -80, y: 420, text: 'Effort →', z: 2, width: 160, fontSize: 20 }),
      ];
      cells.forEach((c, i) => {
        out.push(
          frame(createdBy, {
            x: c.x,
            y: c.y,
            w: 400,
            h: 320,
            text: c.title,
            z: 3 + i,
            fill: c.fill,
            stroke: c.stroke,
          }),
        );
        out.push(
          sticky(createdBy, {
            x: c.x + 40,
            y: c.y + 80,
            fill: STICKY_COLORS[i % STICKY_COLORS.length],
            z: 20 + i,
            w: 140,
            h: 140,
          }),
        );
      });
      return out;
    },
  },
  {
    id: 'retro',
    name: 'Classic retro',
    description: 'Went well / To improve / Actions',
    category: 'retro',
    preview: 'retro',
    build: (createdBy) => {
      const cols = [
        { title: 'Went well', x: -480, color: '#b2f2bb', stroke: '#69db7c' },
        { title: 'To improve', x: -40, color: '#ffa8a8', stroke: GRAVITY.danger },
        { title: 'Actions', x: 400, color: '#a5d8ff', stroke: GRAVITY.link },
      ];
      const out: CanvasObject[] = [];
      cols.forEach((c, i) => {
        out.push(
          frame(createdBy, {
            x: c.x,
            y: -240,
            w: 400,
            h: 560,
            text: c.title,
            z: i + 1,
            fill: 'rgba(255,255,255,0.03)',
            stroke: c.stroke,
          }),
        );
        for (let n = 0; n < 2; n++) {
          out.push(
            sticky(createdBy, {
              x: c.x + 40,
              y: -120 + n * 180,
              fill: c.color,
              z: 10 + i * 2 + n,
            }),
          );
        }
      });
      return out;
    },
  },
  {
    id: 'lean-coffee',
    name: 'Lean Coffee',
    description: 'To discuss / Discussing / Done topics',
    category: 'retro',
    preview: 'lean',
    build: (createdBy) => {
      const cols = [
        { title: 'To discuss', x: -480 },
        { title: 'Discussing', x: -40 },
        { title: 'Done', x: 400 },
      ];
      const out: CanvasObject[] = [];
      cols.forEach((c, i) => {
        out.push(
          frame(createdBy, {
            x: c.x,
            y: -220,
            w: 400,
            h: 500,
            text: c.title,
            z: i + 1,
            stroke: '#7c6cff',
            fill: 'rgba(124, 108, 255, 0.08)',
          }),
        );
        out.push(
          sticky(createdBy, {
            x: c.x + 50,
            y: -80,
            fill: STICKY_COLORS[(i + 2) % STICKY_COLORS.length],
            text: i === 0 ? 'Topic' : '',
            z: 10 + i,
          }),
        );
      });
      return out;
    },
  },
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'To do / Doing / Done with sticky seeds',
    category: 'kanban',
    preview: 'kanban',
    build: (createdBy) => {
      const cols = [
        { title: 'To do', x: -520 },
        { title: 'Doing', x: -40 },
        { title: 'Done', x: 440 },
      ];
      const out: CanvasObject[] = [];
      cols.forEach((c, i) => {
        out.push(
          frame(createdBy, {
            x: c.x,
            y: -200,
            w: 420,
            h: 520,
            text: c.title,
            z: i + 1,
          }),
        );
        out.push(
          sticky(createdBy, {
            x: c.x + 40,
            y: -80,
            fill: STICKY_COLORS[i % STICKY_COLORS.length],
            z: 10 + i,
          }),
        );
      });
      return out;
    },
  },
  {
    id: 'standup',
    name: 'Daily standup',
    description: 'Yesterday / Today / Blockers for the team',
    category: 'kanban',
    preview: 'standup',
    build: (createdBy) => {
      const cols = [
        { title: 'Yesterday', x: -480, stroke: GRAVITY.orbit },
        { title: 'Today', x: -40, stroke: GRAVITY.link },
        { title: 'Blockers', x: 400, stroke: GRAVITY.flare },
      ];
      const out: CanvasObject[] = [];
      cols.forEach((c, i) => {
        out.push(
          frame(createdBy, {
            x: c.x,
            y: -220,
            w: 400,
            h: 480,
            text: c.title,
            z: i + 1,
            stroke: c.stroke,
            fill: 'rgba(255,255,255,0.03)',
          }),
        );
        out.push(
          sticky(createdBy, {
            x: c.x + 40,
            y: -80,
            fill: STICKY_COLORS[i % STICKY_COLORS.length],
            z: 10 + i,
          }),
        );
      });
      return out;
    },
  },
  {
    id: 'sprint-board',
    name: 'Sprint board',
    description: 'Backlog through Done for a two-week sprint',
    category: 'kanban',
    preview: 'sprint',
    build: (createdBy) => {
      const cols = [
        { title: 'Backlog', x: -700 },
        { title: 'Ready', x: -260 },
        { title: 'In progress', x: 180 },
        { title: 'Done', x: 620 },
      ];
      const out: CanvasObject[] = [];
      cols.forEach((c, i) => {
        out.push(
          frame(createdBy, {
            x: c.x,
            y: -220,
            w: 400,
            h: 520,
            text: c.title,
            z: i + 1,
            stroke: i === 3 ? '#69db7c' : GRAVITY.link,
          }),
        );
        if (i < 3) {
          out.push(
            sticky(createdBy, {
              x: c.x + 40,
              y: -80,
              fill: STICKY_COLORS[i % STICKY_COLORS.length],
              text: i === 0 ? 'Story' : '',
              z: 10 + i,
            }),
          );
        }
      });
      return out;
    },
  },
  {
    id: 'flowchart',
    name: 'Flowchart',
    description: 'Start → work → decision → done with connectors',
    category: 'diagram',
    preview: 'flow',
    build: (createdBy) => {
      const start = shape(createdBy, {
        type: 'ellipse',
        x: -70,
        y: -280,
        w: 140,
        h: 70,
        fill: '#38d9a9',
        text: 'Start',
        z: 1,
      });
      const work = shape(createdBy, {
        type: 'rect',
        x: -80,
        y: -120,
        w: 160,
        h: 90,
        fill: GRAVITY.link,
        text: 'Work',
        z: 2,
      });
      const decision = shape(createdBy, {
        type: 'diamond',
        x: -80,
        y: 40,
        w: 160,
        h: 120,
        fill: '#ffb020',
        text: 'Decision?',
        z: 3,
      });
      const done = shape(createdBy, {
        type: 'ellipse',
        x: -70,
        y: 240,
        w: 140,
        h: 70,
        fill: '#ff6b6b',
        text: 'Done',
        z: 4,
      });
      return [
        start,
        work,
        decision,
        done,
        connector(createdBy, start.id, work.id, 5),
        connector(createdBy, work.id, decision.id, 6),
        connector(createdBy, decision.id, done.id, 7),
      ];
    },
  },
  {
    id: 'user-journey',
    name: 'User journey',
    description: 'Stages, actions, and emotion stickies along a path',
    category: 'diagram',
    preview: 'journey',
    build: (createdBy) => {
      const stages = ['Discover', 'Sign up', 'Use', 'Share'];
      const out: CanvasObject[] = [
        text(createdBy, { x: -420, y: -280, text: 'User journey', z: 1, width: 280, fontSize: 28 }),
      ];
      const stageIds: string[] = [];
      stages.forEach((title, i) => {
        const x = -480 + i * 320;
        const f = frame(createdBy, {
          x,
          y: -200,
          w: 280,
          h: 360,
          text: title,
          z: 2 + i,
          stroke: GRAVITY.orbit,
          fill: 'rgba(46, 230, 197, 0.06)',
        });
        stageIds.push(f.id);
        out.push(f);
        out.push(
          sticky(createdBy, {
            x: x + 40,
            y: -80,
            fill: STICKY_COLORS[i % STICKY_COLORS.length],
            text: 'Action',
            z: 20 + i,
            w: 140,
            h: 140,
          }),
        );
        out.push(
          sticky(createdBy, {
            x: x + 40,
            y: 80,
            fill: '#ffe8a3',
            text: 'Feeling',
            z: 30 + i,
            w: 140,
            h: 120,
          }),
        );
      });
      for (let i = 0; i < stageIds.length - 1; i++) {
        out.push(connector(createdBy, stageIds[i], stageIds[i + 1], 40 + i));
      }
      return out;
    },
  },
  {
    id: 'swot',
    name: 'SWOT',
    description: 'Strengths, Weaknesses, Opportunities, Threats',
    category: 'diagram',
    preview: 'swot',
    build: (createdBy) => {
      const cells = [
        { title: 'Strengths', x: -420, y: -280, stroke: '#69db7c' },
        { title: 'Weaknesses', x: 40, y: -280, stroke: GRAVITY.danger },
        { title: 'Opportunities', x: -420, y: 80, stroke: GRAVITY.link },
        { title: 'Threats', x: 40, y: 80, stroke: '#ffb020' },
      ];
      const out: CanvasObject[] = [
        text(createdBy, { x: -100, y: -360, text: 'SWOT', z: 1, width: 160, fontSize: 28 }),
      ];
      cells.forEach((c, i) => {
        out.push(
          frame(createdBy, {
            x: c.x,
            y: c.y,
            w: 400,
            h: 320,
            text: c.title,
            z: 2 + i,
            stroke: c.stroke,
            fill: 'rgba(255,255,255,0.03)',
          }),
        );
        out.push(
          sticky(createdBy, {
            x: c.x + 40,
            y: c.y + 80,
            fill: STICKY_COLORS[i % STICKY_COLORS.length],
            z: 20 + i,
            w: 140,
            h: 140,
          }),
        );
      });
      return out;
    },
  },
  {
    id: 'swimlane',
    name: 'Swimlane process',
    description: 'Three role lanes with a simple process flow',
    category: 'diagram',
    preview: 'swim',
    build: (createdBy) => {
      const lanes = [
        { title: 'Customer', y: -260, stroke: '#ff7eb6' },
        { title: 'Product', y: -20, stroke: GRAVITY.link },
        { title: 'Ops', y: 220, stroke: GRAVITY.orbit },
      ];
      const out: CanvasObject[] = [];
      const nodes: CanvasObject[] = [];
      lanes.forEach((lane, i) => {
        out.push(
          frame(createdBy, {
            x: -520,
            y: lane.y,
            w: 1040,
            h: 200,
            text: lane.title,
            z: i + 1,
            stroke: lane.stroke,
            fill: 'rgba(255,255,255,0.02)',
          }),
        );
        const node = shape(createdBy, {
          type: i === 0 ? 'ellipse' : 'rect',
          x: -200 + i * 220,
          y: lane.y + 50,
          w: 140,
          h: 70,
          fill: i === 0 ? '#ff7eb6' : i === 1 ? GRAVITY.link : GRAVITY.orbit,
          text: i === 0 ? 'Request' : i === 1 ? 'Build' : 'Ship',
          z: 10 + i,
        });
        nodes.push(node);
        out.push(node);
      });
      out.push(connector(createdBy, nodes[0].id, nodes[1].id, 20));
      out.push(connector(createdBy, nodes[1].id, nodes[2].id, 21));
      return out;
    },
  },
];

/** Template ids Orbit may insert via op "template". */
export const ORBIT_TEMPLATE_IDS = [
  'brainstorm',
  'retro',
  'flowchart',
  'kanban',
  'swot',
  'impact-effort',
  'lean-coffee',
  'user-journey',
  'standup',
  'affinity',
  'sprint-board',
  'swimlane',
] as const;
