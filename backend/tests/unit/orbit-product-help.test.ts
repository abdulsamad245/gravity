import { describe, expect, it } from 'vitest';
import {
  looksLikeProductHelpQuestion,
  looksLikeUnhelpfulReply,
  ORBIT_PRODUCT_UI_MAP,
  stripOrbitGapMarker,
} from '../../src/llm/orbit-product-help';

describe('orbit product help', () => {
  it('detects where/how product questions', () => {
    expect(looksLikeProductHelpQuestion('Where is the kanban tool and table tool?')).toBe(true);
    expect(looksLikeProductHelpQuestion('how do I use the laser')).toBe(true);
    expect(looksLikeProductHelpQuestion('make the sticky blue')).toBe(false);
  });

  it('keeps the UI map in sync with core toolbar routes', () => {
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/More tools/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/Laser/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/Connector/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/Gravity/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/Wind/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/Topic magnet/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/Board physics/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/\/rooms\/:roomId/);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/Building tools/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/Voice note/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/Diagram frame/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/New chat/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/Install/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/raise hand/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/clapperboard/i);
    expect(ORBIT_PRODUCT_UI_MAP).toMatch(/talktrack/i);
  });

  it('detects facilitation physics how-tos', () => {
    expect(looksLikeProductHelpQuestion('where is the wind tool')).toBe(true);
    expect(looksLikeProductHelpQuestion('how do I settle the board')).toBe(true);
    expect(looksLikeProductHelpQuestion('where is the voice note')).toBe(true);
    expect(looksLikeProductHelpQuestion('how do I raise hand')).toBe(true);
  });

  it('strips gap markers for logging', () => {
    const { reply, gapReason } = stripOrbitGapMarker(
      'Closest pointer is Templates.\n<!--orbit-gap:unknown_ui-->',
    );
    expect(reply).toBe('Closest pointer is Templates.');
    expect(gapReason).toBe('unknown_ui');
  });

  it('flags unhelpful declines', () => {
    expect(
      looksLikeUnhelpfulReply(
        "Unfortunately, I can't provide information on that directly.",
      ),
    ).toBe(true);
    expect(looksLikeUnhelpfulReply('Table is under Shapes → More shapes.')).toBe(false);
  });
});
