import { indentWithTab } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { yCollab } from 'y-codemirror.next';
import { SelectMenu } from '../../shared/components/SelectMenu';
import {
  CODE_FONT_FAMILY,
  CODE_FONT_SIZE,
  CODE_LANGUAGES,
  type CodeLanguage,
} from '../../shared/constants/code.constants';
import type { CanvasObject } from '../../shared/types';
import { useViewStore } from '../../stores/view.store';
import type { RoomConnection } from '../collaboration/RoomConnection';

interface Props {
  obj: CanvasObject;
  conn: RoomConnection;
  onLanguageChange: (language: CodeLanguage) => void;
  onClose: () => void;
}

const CODE_LANGUAGE_OPTIONS = CODE_LANGUAGES.map((language) => ({
  value: language.id,
  label: language.label,
}));

function languageExtension(language: CodeLanguage): Extension {
  switch (language) {
    case 'typescript':
      return javascript({ typescript: true });
    case 'javascript':
      return javascript();
    case 'python':
      return python();
    case 'go':
      return go();
    case 'rust':
      return rust();
    case 'java':
      return java();
    case 'sql':
      return sql();
    case 'html':
      return html();
    case 'css':
      return css();
    case 'json':
      return json();
    case 'yaml':
      return yaml();
    case 'markdown':
      return markdown();
    default:
      return [];
  }
}

/** Transparent CM chrome — shell CSS supplies light/dark panel colors. */
const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text)',
    fontFamily: CODE_FONT_FAMILY,
  },
  '.cm-scroller': { overflow: 'auto', fontFamily: CODE_FONT_FAMILY },
  '.cm-content': { caretColor: 'var(--link)', padding: '10px 0 18px' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--text-dim)',
    borderRight: '1px solid var(--panel-border)',
  },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--text) 6%, transparent)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--link) 28%, transparent) !important',
  },
  '&.cm-focused': { outline: 'none' },
});

export function CodeEditOverlay({ obj, conn, onLanguageChange, onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onCloseRef = useRef(onClose);
  const languageCompartment = useRef(new Compartment());
  const canvasView = useViewStore();
  const language = obj.language ?? 'typescript';
  onCloseRef.current = onClose;

  useEffect(() => {
    const host = hostRef.current;
    const source = conn.getCodeText(obj.id);
    if (!host || !source) return;
    const undoManager = new Y.UndoManager(source);
    const state = EditorState.create({
      doc: source.toString(),
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        editorTheme,
        EditorView.lineWrapping,
        EditorView.domEventHandlers({
          keydown(event) {
            if (event.key !== 'Escape') return false;
            event.preventDefault();
            onCloseRef.current();
            return true;
          },
        }),
        languageCompartment.current.of(languageExtension(language)),
        yCollab(source, conn.awareness, { undoManager }),
      ],
    });
    const editor = new EditorView({ state, parent: host });
    viewRef.current = editor;
    const raf = requestAnimationFrame(() => editor.focus());
    return () => {
      cancelAnimationFrame(raf);
      editor.destroy();
      undoManager.destroy();
      viewRef.current = null;
    };
  }, [conn, obj.id]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: languageCompartment.current.reconfigure(languageExtension(language)),
    });
  }, [language]);

  const left = obj.x * canvasView.scale + canvasView.x;
  const top = obj.y * canvasView.scale + canvasView.y;
  const width = Math.max(280, obj.width * canvasView.scale);
  const height = Math.max(180, obj.height * canvasView.scale);
  const fontSize = Math.max(11, Math.min(22, (obj.fontSize ?? CODE_FONT_SIZE) * canvasView.scale));

  return (
    <div
      className="code-edit-shell"
      style={{
        left,
        top,
        width,
        height,
        transform: `rotate(${obj.rotation}deg)`,
        fontSize,
      }}
      role="dialog"
      aria-label="Edit code block"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="code-edit-header">
        <span className="code-window-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <SelectMenu
          value={language}
          options={CODE_LANGUAGE_OPTIONS}
          onChange={onLanguageChange}
          ariaLabel="Code language"
          className="code-language-select"
        />
        <button type="button" className="code-done-btn" onClick={onClose}>
          <Check size={15} />
          Done
        </button>
      </div>
      <div ref={hostRef} className="code-editor-host" />
    </div>
  );
}
