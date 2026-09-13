/** Curated sticker packs for the stickers / emoji tool (no external CDN). */
export interface StickerPack {
  id: string;
  name: string;
  stickers: string[];
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'reactions',
    name: 'Simple',
    stickers: ['😍', '🔥', '💯', '👍', '❤️', '😂', '⭐', '✅'],
  },
  {
    id: 'energy',
    name: 'Get Ur Cray On',
    stickers: ['✂️', '🙌', '🧠', '💪', '🚀', '🎯', '✨', '🎉'],
  },
  {
    id: 'crew',
    name: 'Hey, Frank',
    stickers: ['👻', '👾', '🌱', '🦄', '🐸', '🐙', '🐼', '🦊'],
  },
  {
    id: 'disguise',
    name: 'Sticky Disguise',
    stickers: ['🐰', '🤠', '🥸', '🎩', '👑', '🕶️', '🎀', '🧢'],
  },
];

export const ALL_STICKERS = STICKER_PACKS.flatMap((p) => p.stickers);
