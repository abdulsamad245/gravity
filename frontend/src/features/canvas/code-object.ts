import { DEFAULTS } from '../../shared/constants/canvas.constants';
import {
  CODE_BACKGROUND,
  CODE_FONT_FAMILY,
  CODE_FONT_SIZE,
  CODE_TEXT,
  DEFAULT_CODE,
  DEFAULT_CODE_LANGUAGE,
} from '../../shared/constants/code.constants';
import type { CanvasObject } from '../../shared/types';

export function createCodeObject(input: {
  id: string;
  centerX: number;
  centerY: number;
  z: number;
  createdBy: string;
}): CanvasObject {
  return {
    id: input.id,
    type: 'code',
    x: input.centerX - DEFAULTS.code.width / 2,
    y: input.centerY - DEFAULTS.code.height / 2,
    ...DEFAULTS.code,
    rotation: 0,
    fill: CODE_BACKGROUND,
    stroke: '#30363d',
    strokeWidth: 1,
    text: DEFAULT_CODE,
    textColor: CODE_TEXT,
    fontSize: CODE_FONT_SIZE,
    fontFamily: CODE_FONT_FAMILY,
    language: DEFAULT_CODE_LANGUAGE,
    z: input.z,
    createdBy: input.createdBy,
  };
}
