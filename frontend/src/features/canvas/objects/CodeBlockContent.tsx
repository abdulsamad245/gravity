import { Circle, Group, Rect, Text } from 'react-konva';
import {
  CODE_BACKGROUND,
  CODE_FONT_FAMILY,
  CODE_FONT_SIZE,
  CODE_TEXT,
  codeLanguageLabel,
} from '../../../shared/constants/code.constants';
import { DEFAULT_OUTLINE, GRAVITY } from '../../../shared/constants/colors.constants';
import type { CanvasObject } from '../../../shared/types';
import { useThemeStore } from '../../../stores/theme.store';

const HEADER_HEIGHT = 34;
const PADDING = 12;
const LINE_NUMBER_WIDTH = 34;
const LINE_HEIGHT_FACTOR = 1.55;
const TOKEN_PATTERN =
  /(\/\/.*$|#.*$|\/\*.*?\*\/|'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|`(?:\\.|[^`])*`|\b(?:as|async|await|break|case|catch|class|const|continue|def|default|delete|do|else|enum|export|extends|false|finally|fn|for|from|function|go|if|implements|import|in|interface|let|match|new|null|package|private|protected|public|return|select|static|struct|switch|throw|true|try|type|typeof|undefined|var|void|while|yield)\b|\b\d+(?:\.\d+)?\b)/g;

function tokenColor(token: string, light: boolean): string {
  if (token.startsWith('//') || token.startsWith('#') || token.startsWith('/*')) {
    return light ? '#6b7280' : '#8b949e';
  }
  if (/^['"`]/.test(token)) return light ? '#0b6bcb' : '#a5d6ff';
  if (/^\d/.test(token)) return light ? '#0f7a4a' : '#79c0ff';
  return light ? '#7c3aed' : '#d2a8ff';
}

function tokenize(line: string, light: boolean): Array<{ text: string; fill: string }> {
  const parts: Array<{ text: string; fill: string }> = [];
  const base = light ? GRAVITY.ink : CODE_TEXT;
  let cursor = 0;
  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ text: line.slice(cursor, index), fill: base });
    parts.push({ text: match[0], fill: tokenColor(match[0], light) });
    cursor = index + match[0].length;
  }
  if (cursor < line.length) parts.push({ text: line.slice(cursor), fill: base });
  return parts.length ? parts : [{ text: ' ', fill: base }];
}

export function CodeBlockContent({
  obj,
  halfW,
  halfH,
}: {
  obj: CanvasObject;
  halfW: number;
  halfH: number;
}) {
  const resolved = useThemeStore((s) => s.resolved);
  const light = resolved === 'light';
  const fontSize = obj.fontSize ?? CODE_FONT_SIZE;
  const lineHeight = fontSize * LINE_HEIGHT_FACTOR;
  const source = obj.text || '// Double-click to edit';
  const lines = source.split('\n');
  const visibleLines = lines.slice(
    0,
    Math.max(1, Math.floor((obj.height - HEADER_HEIGHT - PADDING * 2) / lineHeight)),
  );
  const codeX = -halfW + PADDING + LINE_NUMBER_WIDTH;
  const codeWidth = Math.max(20, obj.width - PADDING * 2 - LINE_NUMBER_WIDTH);
  const charWidth = fontSize * 0.61;

  // Default board fill is the old dark chrome — swap to theme surface when untouched.
  const usingDefaultFill = !obj.fill || obj.fill === CODE_BACKGROUND;
  const surface = usingDefaultFill ? (light ? '#ffffff' : CODE_BACKGROUND) : obj.fill;
  const stroke = obj.stroke ?? (light ? '#d5d9e2' : '#30363d');
  const muted = light ? '#5c6475' : '#8b949e';
  const gutter = light ? DEFAULT_OUTLINE : '#6e7681';
  const headerWash = light ? 'rgba(18,20,26,0.04)' : 'rgba(255,255,255,0.045)';
  const divider = light ? 'rgba(18,20,26,0.08)' : 'rgba(255,255,255,0.08)';

  return (
    <>
      <Rect
        x={-halfW}
        y={-halfH}
        width={obj.width}
        height={obj.height}
        fill={surface}
        stroke={stroke}
        strokeWidth={obj.strokeWidth ?? 1}
        cornerRadius={10}
        shadowColor={light ? 'rgba(18,20,26,0.14)' : 'rgba(0,0,0,0.45)'}
        shadowBlur={light ? 10 : 14}
        shadowOpacity={0.35}
        shadowOffsetY={4}
      />
      <Rect
        x={-halfW}
        y={-halfH}
        width={obj.width}
        height={HEADER_HEIGHT}
        fill={headerWash}
        cornerRadius={[10, 10, 0, 0]}
      />
      {['#ff5f56', '#ffbd2e', '#27c93f'].map((fill, index) => (
        <Circle key={fill} x={-halfW + 15 + index * 14} y={-halfH + 17} radius={4} fill={fill} opacity={0.9} />
      ))}
      <Text
        x={-halfW + 62}
        y={-halfH + 10}
        width={obj.width - 74}
        text={codeLanguageLabel(obj.language)}
        fontFamily="DM Sans, system-ui, sans-serif"
        fontSize={11}
        fontStyle="bold"
        fill={muted}
        align="right"
      />
      <Rect
        x={-halfW}
        y={-halfH + HEADER_HEIGHT}
        width={obj.width}
        height={1}
        fill={divider}
      />
      <Group
        clipX={-halfW + PADDING}
        clipY={-halfH + HEADER_HEIGHT + PADDING}
        clipWidth={obj.width - PADDING * 2}
        clipHeight={obj.height - HEADER_HEIGHT - PADDING * 2}
      >
        {visibleLines.map((line, lineIndex) => {
          const y = -halfH + HEADER_HEIGHT + PADDING + lineIndex * lineHeight;
          let x = codeX;
          return (
            <Group key={lineIndex}>
              <Text
                x={-halfW + PADDING}
                y={y}
                width={LINE_NUMBER_WIDTH - 8}
                text={String(lineIndex + 1)}
                fontFamily={CODE_FONT_FAMILY}
                fontSize={fontSize}
                fill={gutter}
                align="right"
              />
              <Group clipX={codeX} clipY={y} clipWidth={codeWidth} clipHeight={lineHeight}>
                {tokenize(line, light).map((part, partIndex) => {
                  const partX = x;
                  x += part.text.length * charWidth;
                  return (
                    <Text
                      key={partIndex}
                      x={partX}
                      y={y}
                      text={part.text}
                      fontFamily={CODE_FONT_FAMILY}
                      fontSize={fontSize}
                      fill={part.fill}
                    />
                  );
                })}
              </Group>
            </Group>
          );
        })}
      </Group>
    </>
  );
}
