export const CODE_LANGUAGES = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'java', label: 'Java' },
  { id: 'sql', label: 'SQL' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'mermaid', label: 'Mermaid' },
  { id: 'plain', label: 'Plain text' },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]['id'];

export const DEFAULT_CODE_LANGUAGE: CodeLanguage = 'typescript';
export const DEFAULT_CODE = `function greet(name: string) {
  return \`Hello, \${name}!\`;
}`;
export const CODE_FONT_SIZE = 14;
export const CODE_FONT_FAMILY = 'ui-monospace, "Cascadia Code", Consolas, monospace';
export const CODE_BACKGROUND = '#161b22';
export const CODE_TEXT = '#e6edf3';

export function codeLanguageLabel(language?: string): string {
  return CODE_LANGUAGES.find((item) => item.id === language)?.label ?? 'Plain text';
}
