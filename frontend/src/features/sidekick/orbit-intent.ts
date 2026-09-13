import type { OrbitOp } from '../../shared/api/client';
import { GRAVITY } from '../../shared/constants/colors.constants';
import type { OrbitChromeGuide } from '../tour/chrome-spotlight';

/** Named colors Orbit understands (typos resolved via fuzzy match). */
const NAMED_COLORS: Record<string, string> = {
  blue: GRAVITY.link,
  sky: '#74c0fc',
  navy: '#1a3a6b',
  cyan: GRAVITY.orbit,
  teal: '#1bb89c',
  mint: '#b8f5e8',
  green: '#69db7c',
  lime: '#69db7c',
  yellow: '#ffb020',
  gold: '#ffb020',
  orange: '#ffa94d',
  coral: GRAVITY.flare,
  red: GRAVITY.danger,
  pink: '#ff7eb6',
  magenta: '#ff7eb6',
  purple: '#7c6cff',
  violet: '#b197fc',
  white: '#ffffff',
  black: GRAVITY.ink,
  gray: '#495057',
  grey: '#495057',
  silver: '#ced4da',
  transparent: 'transparent',
};

export interface OrbitContextItem {
  id: string;
  type: string;
  label: string;
  fill?: string;
  text?: string;
}

export interface LocalOrbitIntent {
  reply: string;
  ops: OrbitOp[];
  /** Optional “Show me” spotlight for the control this answer describes. */
  guide?: OrbitChromeGuide;
}

function orbitTool(id: string): string {
  return `[data-orbit-tool="${id}"]`;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/** Resolve a color token / typo / hex from free text. */
export function resolveColorToken(raw: string): { name: string; hex: string } | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  const hex = text.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (hex) {
    let h = hex[0].toLowerCase();
    if (h.length === 4) {
      h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    }
    return { name: h, hex: h };
  }

  const tokens = text
    .replace(/[^a-z0-9#\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  // Prefer longer / clearer matches; allow 1–2 char typos (toiblie → blue via tail).
  let best: { name: string; hex: string; dist: number; len: number } | null = null;
  for (const token of tokens.length ? tokens : [text.replace(/[^a-z]/g, '')]) {
    if (!token || token.length < 3) continue;
    for (const [name, hexVal] of Object.entries(NAMED_COLORS)) {
      const direct = editDistance(token, name);
      const tail =
        token.length > name.length
          ? editDistance(token.slice(-name.length), name)
          : direct;
      const head =
        token.length > name.length
          ? editDistance(token.slice(0, name.length), name)
          : direct;
      const dist = Math.min(direct, tail, head);
      const maxDist = name.length <= 4 ? 1 : 2;
      if (dist > maxDist) continue;
      if (
        !best ||
        dist < best.dist ||
        (dist === best.dist && name.length > best.len)
      ) {
        best = { name, hex: hexVal, dist, len: name.length };
      }
    }
  }
  return best ? { name: best.name, hex: best.hex } : null;
}

function selectionIds(items: OrbitContextItem[]): string[] {
  return items.map((i) => i.id).filter(Boolean);
}

function looksLikeColorChange(prompt: string): boolean {
  return /\b(colou?r|fill|paint|tint|recolou?r|shade)\b/i.test(prompt);
}

function looksLikeDelete(prompt: string): boolean {
  return /\b(delete|remove|erase|trash|get\s+rid\s+of)\b/i.test(prompt);
}

function extractRenameText(prompt: string): string | null {
  const m =
    prompt.match(
      /\b(?:rename|set\s+text|change\s+text|label|call\s+it|text)\s+(?:to|as|=|:)?\s*[“"'`]?(.+?)[”"'`]?\s*$/i,
    ) ?? prompt.match(/\b(?:to|as)\s+[“"'`](.+?)[”"'`]\s*$/i);
  if (!m?.[1]) return null;
  const t = m[1].trim();
  if (!t || resolveColorToken(t)) return null;
  return t.slice(0, 200);
}

function looksLikeLabelRequest(prompt: string): boolean {
  return (
    /\blabels?\b/i.test(prompt) ||
    /\b(caption|name)\s+(them|those|these|it)\b/i.test(prompt) ||
    /\b(add|set|put|give)\s+(?:a\s+)?(text|title|name)s?\b/i.test(prompt)
  );
}

/** Pull "Start, Work, Decision, Done" style lists from prior user wording. */
export function extractListedNames(blob: string): string[] {
  const text = blob.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const withClause = text.match(
    /\b(?:with|steps?|nodes?|boxes?|labels?)\s+([A-Za-z][\w]*(?:\s*,\s*[A-Za-z][\w]*)+(?:\s*,?\s*and\s+[A-Za-z][\w]*)?)/i,
  );
  const raw = withClause?.[1] ?? '';
  if (!raw) return [];
  return raw
    .split(/\s*,\s*|\s+and\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 40)
    .slice(0, 24);
}

/** Short confirmations that almost always mean "do what you just offered". */
const SHORT_AFFIRMATION_RE =
  /^(y|ye|yes|yeah|yep|yup|sure|ok|okay|k|please|do\s*it|go\s*ahead|proceed|sounds\s*good|that\s*works|absolutely|affirmative|of\s*course|yes\s*please|ok\s*please)[.!]*$/i;

export function isShortAffirmation(prompt: string): boolean {
  return SHORT_AFFIRMATION_RE.test(prompt.trim());
}

/** Pull the pending offer / question from the last assistant turn. */
export function extractPendingOffer(assistantText: string): string | null {
  const text = assistantText.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const offer =
    text.match(
      /(?:would you like(?: me)? to|shall i|can i|should i|want me to|i can)\s+(.+?)(?:\?|$)/i,
    ) ?? null;
  if (offer?.[1]) {
    return offer[1].replace(/[.!]+$/g, '').trim().slice(0, 280);
  }
  const sentences = text.split(/(?<=[.!?])\s+/);
  const lastQ = [...sentences].reverse().find((s) => s.includes('?'));
  if (lastQ) return lastQ.replace(/\?+$/g, '').trim().slice(0, 280);
  return text.slice(0, 280);
}

/**
 * Turn "yes" / "ok" into an explicit continue-the-offer prompt using chat history,
 * so the model cannot treat a bare affirmation as a new board-synthesis request.
 */
export function expandAffirmativeFollowUp(
  prompt: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
): string {
  const q = prompt.trim();
  if (!isShortAffirmation(q)) return q;
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role !== 'assistant') continue;
    const offer = extractPendingOffer(turn.text);
    if (!offer) continue;
    return `Yes, please proceed with what you just offered: ${offer}`;
  }
  return q;
}

/**
 * Affirmations that only need a local correction (e.g. laser is not a board object).
 * Returns null so board-building offers ("build a kanban") still go to the LLM.
 */
export function resolveAffirmationLocalIntent(
  prompt: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
): LocalOrbitIntent | null {
  if (!isShortAffirmation(prompt)) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role !== 'assistant') continue;
    const offer = extractPendingOffer(turn.text) ?? turn.text;
    if (/\blaser\b/i.test(offer)) {
      return resolveProductSupportIntent('what is the laser tool for');
    }
    return null;
  }
  return null;
}

function help(reply: string, guide?: OrbitChromeGuide): LocalOrbitIntent {
  return guide ? { reply, ops: [], guide } : { reply, ops: [] };
}

/** Instant product-help answers (no LLM) for "where is…" / tool how-tos. */
export function resolveProductSupportIntent(prompt: string): LocalOrbitIntent | null {
  const q = prompt.trim();
  if (!q) return null;
  const looking =
    /\b(where|how|find|locate|open|access|get to|navigate|which menu|which tool|what('?s| is)|whats)\b/i.test(
      q,
    ) || /\b(tool|button|toolbar)\b/i.test(q);
  const toolish =
    /\b(kanban|table|mind\s*map|stickers?|emoji|gifs?|embed|template|shapes?|more\s*tools?|laser|stamp|connector|rope|attract|repel|wind|magnet|archive|shake|settle|gravity|physics|voting|votes?|timer|sticky|frame|highlighter|eraser|pen|pencil|draw|code|comment|image|upload|replay|export|share|invite|live\s*call|join\s*call|theme|dark\s*mode|text\s*tool|hand\s*tool|select\s*tool|chart|pie|donut|radar|scatter|video|pdf|resources?|voice|mic|present|talktrack|install|pwa|diagram|brainstorm|reaction|hand\s*raise|raise\s*hand|minimap|tour|timeline)\b/i.test(
      q,
    );
  // Require a how-to/where cue so "create a kanban" reaches the board agent, not this map.
  if (!looking || !toolish) return null;

  const mentions = (re: RegExp) => re.test(q);
  // Allow light typos (tablke, kanbam) on the tool names users ask about most.
  const wantsKanban = mentions(/\bkanban\b/i) || /\bkanb\w*/i.test(q);
  const wantsTable = mentions(/\btable\b/i) || /\btabl\w*/i.test(q);

  if (wantsKanban && wantsTable) {
    return help(
      'Table is under Shapes → More shapes → Building tools → Table. Kanban is a view on that same Table (open it and switch to Kanban), or use Templates → Kanban. I can also place a kanban board for you if you want.',
      {
        label: 'Show More shapes',
        selector: orbitTool('shapesMore'),
        reveal: 'shapesMore',
        fallbackSelector: orbitTool('shapes'),
      },
    );
  }
  if (wantsKanban) {
    return help(
      'Kanban is not a separate toolbar icon. Place a Table (Shapes → More shapes → Building tools → Table), open it, then switch the view to Kanban. Or use Templates → Kanban, or ask me to build a kanban board here.',
      {
        label: 'Show Templates',
        selector: '[data-tour="templates"]',
        reveal: 'templates',
      },
    );
  }
  if (wantsTable) {
    return help(
      'Table is under ··· More tools → Other resources → Table, or Shapes → More shapes → Building tools → Table. Click the canvas to place it. Inside the table you can switch Table / Kanban / Timeline views.',
      {
        label: 'Show More shapes',
        selector: orbitTool('shapesMore'),
        reveal: 'shapesMore',
        fallbackSelector: orbitTool('shapes'),
      },
    );
  }
  if (mentions(/\bcharts?\b/i) || mentions(/\b(pie|donut|radar|scatter|bar\s*chart|line\s*chart)\b/i)) {
    return help(
      'Charts are under ··· More tools → Charts. Pick clustered/stacked columns or bars, 100% stacks, combination, line, area, pie, donut, rose, scatter, or radar. Change the type later from the selection bar.',
      {
        label: 'Show Charts',
        selector: '[aria-label="Charts"]',
        reveal: 'charts',
        fallbackSelector: orbitTool('moreTools'),
      },
    );
  }
  if (mentions(/\b(video|pdf|document|resources?)\b/i)) {
    return help(
      'Other resources is under ··· More tools → Other resources: Image, Video (max 1.5 MB), Audio, Document, Table, Slide, PDF, and File.',
      {
        label: 'Show Other resources',
        selector: '[aria-label="Other resources"]',
        reveal: 'resources',
        fallbackSelector: orbitTool('moreTools'),
      },
    );
  }
  if (mentions(/\bmind\s*maps?\b/i)) {
    return help(
      'Mind map is under the left toolbar: Shapes → More shapes → Building tools → Mind map. Select a node for Add child and Auto-layout.',
      {
        label: 'Show More shapes',
        selector: orbitTool('shapesMore'),
        reveal: 'shapesMore',
        fallbackSelector: orbitTool('shapes'),
      },
    );
  }
  if (mentions(/\bconnectors?\b/i) || (mentions(/\bconnect\b/i) && looking)) {
    return help(
      'Connectors are the Connect button on the left toolbar: Straight (C), Right angle, Curved, and Polyline. Click two objects to link them. Change style on the selection bar. For a free line that is not attached, use Shapes → Line.',
      {
        label: 'Show Connect',
        fallbackSelector: '[data-tour="connect"]',
        selector: orbitTool('connect'),
        reveal: 'connect',
      },
    );
  }
  if (mentions(/\bropes?\b/i)) {
    return help(
      'Rope is under Physics on the left toolbar (shortcut G). It physically tethers objects when physics is on.',
      {
        label: 'Show Rope',
        selector: orbitTool('rope'),
        reveal: 'physics',
        fallbackSelector: orbitTool('physics'),
      },
    );
  }
  if (mentions(/\battract\b/i) && mentions(/\brepel\b/i)) {
    return help(
      'Attract and Repel are under Physics on the left toolbar. Attract (A) pulls nearby objects toward your cursor; Repel (X) pushes them away. Hold the tool near objects to apply the force.',
      {
        label: 'Show Physics',
        selector: orbitTool('physics'),
        reveal: 'physics',
        fallbackSelector: orbitTool('physics'),
      },
    );
  }
  if (mentions(/\battract\b/i)) {
    return help(
      'Attract is under Physics on the left toolbar (shortcut A). Hold it near objects to pull them toward your cursor.',
      {
        label: 'Show Attract',
        selector: orbitTool('attract'),
        reveal: 'physics',
        fallbackSelector: orbitTool('physics'),
      },
    );
  }
  if (mentions(/\brepel\b/i)) {
    return help(
      'Repel is under Physics on the left toolbar (shortcut X). Hold it near objects to push them away.',
      {
        label: 'Show Repel',
        selector: orbitTool('repel'),
        reveal: 'physics',
        fallbackSelector: orbitTool('physics'),
      },
    );
  }
  if (mentions(/\bwind\b/i)) {
    return help(
      'Wind is under Physics on the left toolbar (shortcut W). Hold and drag to push nearby physics objects in that direction.',
      {
        label: 'Show Wind',
        selector: orbitTool('wind'),
        reveal: 'physics',
        fallbackSelector: orbitTool('physics'),
      },
    );
  }
  if (mentions(/\b(magnet|topic\s*magnet)\b/i)) {
    return help(
      'Topic magnet is under Physics on the left toolbar (shortcut J), or Facilitate → Board physics. It pulls nearby physics-enabled objects into a cluster. You can also turn a selection into a magnet from the selection toolbar.',
      {
        label: 'Show Topic magnet',
        selector: orbitTool('magnet'),
        reveal: 'physics',
        fallbackSelector: orbitTool('physics'),
      },
    );
  }
  if (mentions(/\b(archive\s*well|archive)\b/i) && mentions(/\b(physics|well|park|board)\b/i)) {
    return help(
      'Archive well is under Physics on the left toolbar (shortcut Z), or Facilitate → Board physics. Physics objects that fall into it get parked (dimmed, physics off). Restore from the selection toolbar.',
      {
        label: 'Show Archive well',
        selector: orbitTool('archiveWell'),
        reveal: 'physics',
        fallbackSelector: orbitTool('physics'),
      },
    );
  }
  if (mentions(/\b(shake|settle|align)\b/i)) {
    return help(
      'Shake board and Settle / align are under Facilitate → Board physics. Shake scatters loose objects; Settle lays them into a neat grid.',
      {
        label: 'Show Facilitate',
        selector: '[data-tour="facilitate"]',
        reveal: 'facilitate',
      },
    );
  }
  if (mentions(/\bgravity\b/i)) {
    return help(
      'Board gravity is the Gravity toggle near the bottom of the left toolbar (on mobile it sits bottom-right). When on, loose physics-enabled objects fall and stack for everyone in the room. Locked objects stay pinned; votes make cards heavier so they shove less easily.',
      { label: 'Show Gravity', selector: orbitTool('gravity'), fallbackSelector: '[data-tour="gravity"]' },
    );
  }
  if (mentions(/\blaser\b/i)) {
    return help(
      'Laser (K) is in the Draw flyout (pencil). It is a live facilitation pointer: others see your stroke while you draw, but it is not saved. Use Connector or Line for something that stays.',
      {
        label: 'Show Laser',
        selector: orbitTool('laser'),
        reveal: 'draw',
        fallbackSelector: orbitTool('draw'),
      },
    );
  }
  if (mentions(/\bstamps?\b/i) && !mentions(/\bstickers?\b/i)) {
    return help(
      'Stamp (M) is in the Draw flyout (pencil). For stickers, emoji, or GIFs, use the smiley button on the left toolbar.',
      {
        label: 'Show Stamp',
        selector: orbitTool('stamp'),
        reveal: 'draw',
        fallbackSelector: orbitTool('draw'),
      },
    );
  }
  if (mentions(/\b(stickers?|emoji|gifs?)\b/i)) {
    return help('Stickers, emoji, and GIFs are the smiley button on the left toolbar.', {
      label: 'Show Stickers',
      selector: orbitTool('stickers'),
      reveal: 'stickers',
    });
  }
  if (mentions(/\b(web\s*)?embed\b/i)) {
    return help(
      'Web embed is under ··· More tools → Web embed. Paste a public https URL to place it. Private or local hosts are blocked.',
      {
        label: 'Show Web embed',
        selector: orbitTool('embed'),
        reveal: 'moreTools',
        fallbackSelector: orbitTool('moreTools'),
      },
    );
  }
  if (mentions(/\b(sticky|stickies|sticky\s*notes?)\b/i) && looking) {
    return help('Sticky notes are the sticky-note button on the left toolbar. Click the canvas to place one.', {
      label: 'Show Sticky note',
      selector: orbitTool('sticky'),
      fallbackSelector: '[data-tour="sticky"]',
    });
  }
  if (
    mentions(/\b(text\s*tool|text\s*box|type\s*tool)\b/i) ||
    (mentions(/\btext\b/i) && /\b(where|find|locate|which)\b/i.test(q) && /\b(tool|button|toolbar)\b/i.test(q))
  ) {
    return help('Text is the text button on the left toolbar. Click the canvas to place a text box.', {
      label: 'Show Text',
      selector: orbitTool('text'),
    });
  }
  if (mentions(/\bcode\s*blocks?\b/i) || (mentions(/\bcode\b/i) && looking)) {
    return help('Code block is the code button on the left toolbar. Click the canvas to place one.', {
      label: 'Show Code block',
      selector: orbitTool('code'),
    });
  }
  if (mentions(/\bframes?\b/i) && looking) {
    return help('Frame is the frame button on the left toolbar. Drag on the canvas to create a frame.', {
      label: 'Show Frame',
      selector: orbitTool('frame'),
    });
  }
  if (mentions(/\bcomments?\b/i) && looking) {
    return help('Comment is the speech-bubble button on the left toolbar. Click the canvas to pin a comment.', {
      label: 'Show Comment',
      selector: orbitTool('comment'),
    });
  }
  if (mentions(/\b(images?|upload\s*image|add\s*image|photo)\b/i)) {
    return help('Add image is the image button on the left toolbar. Pick a local image file to place it on the board.', {
      label: 'Show Add image',
      selector: orbitTool('image'),
    });
  }
  if (mentions(/\b(highlighter|pen|pencil|eraser|draw)\b/i) && looking) {
    return help(
      'Drawing tools are under the pencil (Draw) button: Pen (P), Highlighter (U), Eraser (E), plus Laser (K) and Stamp (M).',
      {
        label: 'Show Draw',
        selector: orbitTool('draw'),
        reveal: 'draw',
      },
    );
  }
  if (mentions(/\b(voting|votes?)\b/i) && looking) {
    return help(
      'Voting lives under Facilitate (clock) in the top bar. Enter a prompt, set votes per person, optional time limit, and anonymous results (on by default), then Start voting. Everyone selects board objects and taps Vote on the selection bar. Tallies stay hidden until the host reveals (or the timer ends). Tap I\'m done so the host sees who finished. Reveal writes counts onto objects so they stay after Clear, and votes add physics mass. Without a session, Vote is a public upvote that shows counts right away.',
      {
        label: 'Show Facilitate',
        selector: '[data-tour="facilitate"]',
        reveal: 'facilitate',
      },
    );
  }
  if (mentions(/\btimers?\b/i)) {
    return help(
      'The shared timer is under Facilitate (clock) in the top bar. Pick a preset or custom time, pause / resume, add time, optionally play music, and hear an end chime. Time up stays until you reset.',
      {
        label: 'Show Facilitate',
        selector: '[data-tour="facilitate"]',
        reveal: 'facilitate',
      },
    );
  }
  if (mentions(/\b(private\s*brainstorm|brainstorm\s*round)\b/i)) {
    return help(
      'Private brainstorm is under Facilitate (clock). Sticky text stays hidden until the host reveals the round.',
      {
        label: 'Show Facilitate',
        selector: '[data-tour="facilitate"]',
        reveal: 'facilitate',
      },
    );
  }
  if (mentions(/\b(hand\s*raise|raise\s*hand|reactions?)\b/i)) {
    return help(
      'Raise hand and reactions are under Facilitate (clock). Raised hands show on avatars; reactions float on the board.',
      {
        label: 'Show Facilitate',
        selector: '[data-tour="facilitate"]',
        reveal: 'facilitate',
      },
    );
  }
  if (mentions(/\breplay\b/i) || mentions(/\btime\s*travel\b/i)) {
    return help(
      'Session replay is the clapperboard button in the top bar (next to Present). From the replay bar you can scrub, rewind / fast-forward, change speed, or export history / WebM. Video export keeps running if you Exit replay and edit the live board: Hide the progress card, leave this tab open, and you get a toast (and a desktop notification if the tab is in the background) when the WebM is ready. Offline edits still sync when you reconnect. More → Board → Open session history opens a saved session history file.',
      {
        label: 'Show Replay',
        selector: '[data-tour="replay"]',
        fallbackSelector: '[data-tour="more"]',
      },
    );
  }
  if (mentions(/\bpresent\b/i) || mentions(/\btalktrack\b/i) || mentions(/\bslides?\b/i)) {
    return help(
      'Present is in the top bar. Add Frame objects first, then Present to walk them as slides (keyboard nav, slide overview). You can record a talktrack with the mic and download a WebM.',
      {
        label: 'Show Present',
        selector: '[data-tour="present"]',
        fallbackSelector: '[data-tour="frame"]',
      },
    );
  }
  if (mentions(/\bexport\b/i) && looking) {
    return help('Export the board as PNG, SVG, or JSON from More (···) in the top bar.', {
      label: 'Show More menu',
      selector: '[data-tour="more"]',
      reveal: 'moreMenu',
    });
  }
  if (mentions(/\b(install|pwa|home\s*screen)\b/i)) {
    return help(
      'Install Gravity is under More (···) when the app is served as a production / Docker build (not plain Vite dev). You can also use the soft Install prompt inside a room.',
      {
        label: 'Show More menu',
        selector: '[data-tour="more"]',
        reveal: 'moreMenu',
      },
    );
  }
  if (
    mentions(/\bshare\b/i) ||
    mentions(/\binvite\b/i) ||
    mentions(/\blive\s*call\b/i) ||
    mentions(/\bjoin\s*call\b/i) ||
    mentions(/\bgoogle\s*meet\b/i) ||
    mentions(/\bzoom\s*(link|call|meeting|invite)\b/i) ||
    mentions(/\b(discord|whereby|webex|jitsi|skype)\b/i) ||
    mentions(/\b(microsoft\s*)?teams\b/i)
  ) {
    return help(
      'Share is in the top bar: copy an invite link, send email invites, set link access (Can edit / Can view), or grab an iframe embed. The room creator can paste a Meet, Zoom, Discord, Teams, Whereby, Webex, Jitsi, or Skype Live call link; everyone else uses Join call when one is set.',
      {
        label: 'Show Share',
        selector: '[data-tour="share"]',
        reveal: 'share',
      },
    );
  }
  if (mentions(/\btheme\b/i) || mentions(/\bdark\s*mode\b/i) || mentions(/\bcanvas\s*background\b/i)) {
    return help('Theme (light / dark / system) and canvas background are under More (···) in the top bar.', {
      label: 'Show More menu',
      selector: '[data-tour="more"]',
      reveal: 'moreMenu',
    });
  }
  if (mentions(/\b(voice\s*notes?|microphone|mic)\b/i) && looking) {
    return help('Voice note is the mic on the left toolbar, next to Add image. It records an audio note onto the board.', {
      label: 'Show Voice note',
      selector: orbitTool('voice'),
      fallbackSelector: '[data-tour="media"]',
    });
  }
  if (mentions(/\bdiagrams?\b/i) && looking) {
    return help(
      'Diagram frames are under Shapes → Diagram on the left toolbar. That places an empty diagram frame with quick-start actions. Flowchart templates are under Templates.',
      {
        label: 'Show Shapes',
        selector: orbitTool('shapes'),
        reveal: 'shapes',
      },
    );
  }
  if (mentions(/\bminimap\b/i) || mentions(/\bradar\b/i)) {
    return help('The minimap radar is in the bottom-right. Click it to jump the camera; it shows other people’s viewports.', {
      label: 'Show Minimap',
      selector: '[data-tour="minimap"]',
    });
  }
  if (mentions(/\btour\b/i) && looking) {
    return help('The product tour is under More (···) → Take a tour. It walks the main board chrome once on first visit.', {
      label: 'Show More menu',
      selector: '[data-tour="more"]',
      reveal: 'moreMenu',
    });
  }
  if (mentions(/\btemplates?\b/i)) {
    return help(
      'Templates are in the top bar. You can also ask me for a starter like retro, kanban, or flowchart.',
      {
        label: 'Show Templates',
        selector: '[data-tour="templates"]',
        reveal: 'templates',
      },
    );
  }
  if (mentions(/\bshapes?\b/i) && looking) {
    return help(
      'Basic shapes are the Shapes button on the left toolbar. Diagram frames, extra libraries (flowchart, UML, cloud icons), Building tools (Table, Mind map), and packs like star / hexagon are under Shapes → More shapes.',
      {
        label: 'Show Shapes',
        selector: orbitTool('shapes'),
        reveal: 'shapes',
      },
    );
  }
  if (mentions(/\bphysics\b/i) && looking) {
    return help(
      'Physics is on the left toolbar: Rope (G), Attract (A), Repel (X), Wind (W), Topic magnet (J), and Archive well (Z). Turn Gravity on below the rail so objects fall and stack. Shake and Settle are under Facilitate → Board physics.',
      {
        label: 'Show Physics',
        selector: orbitTool('physics'),
        reveal: 'physics',
        fallbackSelector: '[data-tour="physics"]',
      },
    );
  }
  if (mentions(/\bmore\s*tools\b/i)) {
    return help(
      'Voice note is the mic on the primary rail (next to Image). ··· More tools has Create extras: web embed, charts, and other resources. Physics tools are the Physics button on the primary rail. Board Gravity is the toggle below.',
      {
        label: 'Show More tools',
        selector: orbitTool('moreTools'),
        reveal: 'moreTools',
        fallbackSelector: '[data-tour="moreTools"]',
      },
    );
  }

  return null;
}

/**
 * Handle common edits without an LLM round-trip.
 * Uses selection first, otherwise recent Orbit-created items ("them").
 */
export function resolveLocalOrbitIntent(
  prompt: string,
  selected: OrbitContextItem[],
  recent: OrbitContextItem[] = [],
  historyBlob = '',
): LocalOrbitIntent | null {
  const q = prompt.trim();
  if (!q) return null;

  const support = resolveProductSupportIntent(q);
  if (support) return support;

  const targets = (selected.length ? selected : recent).filter((t) => t.type !== 'connector');
  if (!targets.length) return null;
  const ids = selectionIds(targets);
  if (!ids.length) return null;

  const noun =
    targets.length === 1
      ? targets[0].type === 'rect'
        ? 'rectangle'
        : targets[0].type
      : `${targets.length} items`;

  if (looksLikeLabelRequest(q)) {
    const names = extractListedNames(historyBlob);
    if (names.length) {
      const ops: OrbitOp[] = [];
      const n = Math.min(names.length, targets.length);
      for (let i = 0; i < n; i++) {
        ops.push({ op: 'update', id: targets[i].id, patch: { text: names[i] } });
      }
      if (ops.length) {
        return { reply: `Added labels to the ${noun}.`, ops };
      }
    }
    // Still have targets — let the LLM label from history with RECENT_ORBIT ids.
    return null;
  }

  if (looksLikeDelete(q)) {
    return {
      reply: `Removed the ${noun} from the board.`,
      ops: ids.map((id) => ({ op: 'delete' as const, id })),
    };
  }

  const rename = extractRenameText(q);
  if (rename) {
    return {
      reply: `Updated the text on the ${noun}.`,
      ops: ids.map((id) => ({ op: 'update' as const, id, patch: { text: rename } })),
    };
  }

  const color = resolveColorToken(q);
  const colorIntent = looksLikeColorChange(q) || Boolean(color && q.split(/\s+/).length <= 4);

  if (colorIntent && color) {
    return {
      reply: `Changed the ${noun} to ${color.name}.`,
      ops: ids.map((id) => ({ op: 'update' as const, id, patch: { fill: color.hex } })),
    };
  }

  if (looksLikeColorChange(q) && !color) {
    return {
      reply: `Which color should I use for the ${noun}? Try blue, coral, mint, or a hex like ${GRAVITY.link}.`,
      ops: [],
    };
  }

  return null;
}
