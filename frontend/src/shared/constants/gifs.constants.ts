/** Curated reaction GIFs for the stickers panel (no API key). */
export type GifSticker = {
  id: string;
  label: string;
  /** Direct media URL (animated). */
  src: string;
  /** Preview still (same asset is fine). */
  preview?: string;
};

/**
 * Short reaction GIFs via Giphy media CDN. Labels power search.
 * Placed on the board as image objects; HTML overlay keeps animation.
 */
export const GIF_STICKERS: GifSticker[] = [
  {
    id: 'thumbs',
    label: 'thumbs up yes approve',
    src: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  },
  {
    id: 'clap',
    label: 'clap applause bravo',
    src: 'https://media.giphy.com/media/7rj2ZgttXuwKvBXgW2/giphy.gif',
  },
  {
    id: 'fire',
    label: 'fire lit amazing',
    src: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
  },
  {
    id: 'mindblown',
    label: 'mind blown wow',
    src: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
  },
  {
    id: 'party',
    label: 'party celebration confetti',
    src: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  },
  {
    id: 'lol',
    label: 'lol laugh funny haha',
    src: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
  },
  {
    id: 'heart',
    label: 'love heart like',
    src: 'https://media.giphy.com/media/3o7TKnO6Wve6502iJ2/giphy.gif',
  },
  {
    id: 'think',
    label: 'thinking hmm consider',
    src: 'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif',
  },
  {
    id: 'shipit',
    label: 'ship it rocket launch',
    src: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
  },
  {
    id: 'done',
    label: 'done check complete',
    src: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  },
  {
    id: 'wow',
    label: 'wow surprise oh',
    src: 'https://media.giphy.com/media/3oEjI5VtIhHvK37WYo/giphy.gif',
  },
  {
    id: 'sad',
    label: 'sad cry disappointed',
    src: 'https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif',
  },
];

export function isGifSrc(src: string | undefined | null): boolean {
  if (!src) return false;
  const lower = src.toLowerCase();
  return lower.includes('.gif') || lower.includes('image/gif') || lower.includes('giphy.gif');
}
