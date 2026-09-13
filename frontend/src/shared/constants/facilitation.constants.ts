export interface FacilitationReaction {
  id: string;
  glyph: string;
  label: string;
  hint: string;
}

/** In-the-moment reactions for facilitation sessions. */
export const FACILITATION_REACTIONS: FacilitationReaction[] = [
  { id: 'love', glyph: '❤️', label: 'Love', hint: 'Love it' },
  { id: 'yes', glyph: '👍', label: 'Yes', hint: 'Thumbs up' },
  { id: 'fire', glyph: '🔥', label: 'Fire', hint: 'Fire' },
  { id: 'wow', glyph: '😮', label: 'Wow', hint: 'Wow' },
  { id: 'yay', glyph: '🎉', label: 'Yay', hint: 'Celebrate' },
  { id: 'hey', glyph: '👋', label: 'Hey', hint: 'Hey / wave' },
];

/** @deprecated Prefer FACILITATION_REACTIONS; kept for stamp/sticker packs. */
export const FACILITATION_STAMPS = FACILITATION_REACTIONS;

export const REACTION_TTL_MS = 3800;

export const TIMER_PRESETS_SEC = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
] as const;

export const TIMER_CUSTOM_MIN = 0;
export const TIMER_CUSTOM_MAX_MIN = 99;
export const TIMER_CUSTOM_MAX_SEC = 59;

export const TIMER_ADD_OPTIONS_SEC = [
  { label: '+1m', seconds: 60 },
  { label: '+5m', seconds: 300 },
] as const;

/** Royalty-free-style ambient beds (synthesized locally — no media files). */
export interface TimerMusicTrack {
  id: string;
  label: string;
}

export const TIMER_MUSIC_TRACKS: TimerMusicTrack[] = [
  { id: 'none', label: 'No music' },
  { id: 'focus', label: 'Focus' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'calm', label: 'Calm' },
];

/** Optional voting session countdown (0 = no timer). */
export const VOTING_DURATION_PRESETS_SEC = [
  { label: 'No limit', seconds: 0 },
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
] as const;

export const VOTING_VOTE_LIMIT_MIN = 1;
export const VOTING_VOTE_LIMIT_MAX = 20;
export const VOTING_PROMPT_MAX = 120;
