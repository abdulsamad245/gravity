import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EMOJI_GROUPS } from '../../shared/constants/emoji.constants';
import { GIF_STICKERS } from '../../shared/constants/gifs.constants';
import { ALL_STICKERS, STICKER_PACKS } from '../../shared/constants/stickers.constants';
import { useUiStore } from '../../stores/ui.store';

type TabId = 'all' | 'stickers' | 'emojis' | 'gifs';
type ShowAll = null | 'stickers' | 'emojis' | 'gifs';

interface Props {
  onClose: () => void;
}

export function StickersFlyout({ onClose }: Props) {
  const { stampGlyph, stampGifSrc, setStampGlyph, setStampGifSrc, setTool } = useUiStore();
  const [tab, setTab] = useState<TabId>('all');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState<ShowAll>(null);

  const needle = query.trim().toLowerCase();

  const emojiFlat = useMemo(() => EMOJI_GROUPS.flatMap((g) => g.emojis), []);

  const filteredStickers = useMemo(() => {
    if (!needle) return ALL_STICKERS;
    return ALL_STICKERS.filter((s) => s.includes(needle) || packNameFor(s).includes(needle));
  }, [needle]);

  const filteredEmojis = useMemo(() => {
    if (!needle) return emojiFlat;
    return emojiFlat.filter((e) => e.includes(needle));
  }, [emojiFlat, needle]);

  const filteredGifs = useMemo(() => {
    if (!needle) return GIF_STICKERS;
    return GIF_STICKERS.filter((g) => g.label.includes(needle) || g.id.includes(needle));
  }, [needle]);

  const pickGlyph = (glyph: string) => {
    setStampGifSrc(null);
    setStampGlyph(glyph);
    setTool('stamp');
    onClose();
  };

  const pickGif = (src: string) => {
    setStampGifSrc(src);
    setTool('stamp');
    onClose();
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'stickers', label: 'Stickers' },
    { id: 'emojis', label: 'Emoji' },
    { id: 'gifs', label: 'GIFs' },
  ];

  return (
    <div className="stickers-flyout panel" role="dialog" aria-label="Stickers, Emoji and GIFs">
      <label className="stickers-search">
        <Search size={15} aria-hidden />
        <input
          className="input"
          placeholder="Search stickers, emoji, GIFs"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowAll(null);
          }}
          aria-label="Search stickers, emoji, and GIFs"
        />
      </label>

      <div className="stickers-tabs" role="tablist" aria-label="Categories">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => {
              setTab(t.id);
              setShowAll(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="stickers-body">
        {(tab === 'stickers' || (tab === 'all' && showAll !== 'emojis' && showAll !== 'gifs')) && (
          <section className="stickers-section" aria-label="Stickers">
            {tab === 'all' && !showAll && (
              <div className="stickers-section-head">
                <h3>Stickers</h3>
                <button type="button" className="stickers-show-all" onClick={() => setShowAll('stickers')}>
                  Show all
                </button>
              </div>
            )}
            {(showAll === 'stickers' || tab === 'stickers' || needle) && (
              <div className="stickers-grid">
                {(needle ? filteredStickers : ALL_STICKERS).map((s) => (
                  <button
                    key={`s-${s}`}
                    type="button"
                    className={`sticker-cell ${!stampGifSrc && stampGlyph === s ? 'active' : ''}`}
                    aria-label={`Place ${s}`}
                    onClick={() => pickGlyph(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {tab === 'all' && !showAll && !needle && (
              <div className="sticker-packs">
                {STICKER_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    className="sticker-pack-card"
                    onClick={() => setShowAll('stickers')}
                  >
                    <strong>{pack.name}</strong>
                    <span className="sticker-pack-preview" aria-hidden>
                      {pack.stickers.slice(0, 3).join('')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {(tab === 'emojis' || (tab === 'all' && showAll !== 'stickers' && showAll !== 'gifs')) && (
          <section className="stickers-section" aria-label="Emoji">
            {tab === 'all' && !showAll && (
              <div className="stickers-section-head">
                <h3>Emoji</h3>
                <button type="button" className="stickers-show-all" onClick={() => setShowAll('emojis')}>
                  Show all
                </button>
              </div>
            )}
            {tab === 'all' && !showAll && !needle ? (
              <div className="stickers-grid stickers-grid-preview">
                {emojiFlat.slice(0, 14).map((e) => (
                  <button
                    key={`e-${e}`}
                    type="button"
                    className={`sticker-cell ${!stampGifSrc && stampGlyph === e ? 'active' : ''}`}
                    aria-label={`Place ${e}`}
                    onClick={() => pickGlyph(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            ) : (
              (tab === 'emojis' || showAll === 'emojis' || needle) && (
                <div className="stickers-grid">
                  {(needle ? filteredEmojis : emojiFlat).map((e) => (
                    <button
                      key={`ef-${e}`}
                      type="button"
                      className={`sticker-cell ${!stampGifSrc && stampGlyph === e ? 'active' : ''}`}
                      aria-label={`Place ${e}`}
                      onClick={() => pickGlyph(e)}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )
            )}
          </section>
        )}

        {(tab === 'gifs' || (tab === 'all' && showAll !== 'stickers' && showAll !== 'emojis')) && (
          <section className="stickers-section" aria-label="GIFs">
            {tab === 'all' && !showAll && (
              <div className="stickers-section-head">
                <h3>GIFs</h3>
                <button type="button" className="stickers-show-all" onClick={() => setShowAll('gifs')}>
                  Show all
                </button>
              </div>
            )}
            {(showAll === 'gifs' || tab === 'gifs' || needle || (tab === 'all' && !showAll)) && (
              <div className="stickers-grid stickers-gif-grid">
                {(needle || tab === 'gifs' || showAll === 'gifs' ? filteredGifs : GIF_STICKERS.slice(0, 6)).map(
                  (g) => (
                    <button
                      key={g.id}
                      type="button"
                      className={`sticker-cell sticker-gif-cell ${stampGifSrc === g.src ? 'active' : ''}`}
                      aria-label={`Place GIF ${g.label}`}
                      onClick={() => pickGif(g.src)}
                    >
                      <img src={g.preview ?? g.src} alt="" loading="lazy" draggable={false} />
                    </button>
                  ),
                )}
              </div>
            )}
          </section>
        )}

        {showAll && tab === 'all' && (
          <button type="button" className="btn stickers-back" onClick={() => setShowAll(null)}>
            Back
          </button>
        )}
      </div>
    </div>
  );
}

function packNameFor(sticker: string): string {
  return STICKER_PACKS.find((p) => p.stickers.includes(sticker))?.name.toLowerCase() ?? '';
}
