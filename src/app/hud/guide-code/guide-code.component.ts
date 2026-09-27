import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type CodeTokenKind =
  | 'plain'
  | 'comment'
  | 'keyword'
  | 'literal'
  | 'number'
  | 'string'
  | 'function'
  | 'operator'
  | 'punctuation';

interface CodeToken {
  readonly text: string;
  readonly kind: CodeTokenKind;
}

const TOKEN_PATTERN =
  /\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:let|if|else|while|for|repeat|parallel|def|return|import|from)\b|\b(?:true|false|null)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*(?=\s*\()|===|!==|==|!=|<=|>=|\+\+|--|&&|\|\||[+\-*/%=<>!]|[()[\]{},.;]/g;

const KEYWORDS = new Set([
  'let',
  'if',
  'else',
  'while',
  'for',
  'repeat',
  'parallel',
  'def',
  'return',
  'import',
  'from',
]);
const LITERALS = new Set(['true', 'false', 'null']);
const OPERATORS = new Set([
  '+',
  '-',
  '*',
  '/',
  '%',
  '=',
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  '===',
  '!==',
  '++',
  '--',
  '&&',
  '||',
  '!',
]);

@Component({
  selector: 'app-guide-code',
  template: `
    <pre
      [class.compact]="compact()"
    ><code>@for (token of tokens(); track $index) {<span [class]="'token-' + token.kind">{{ token.text }}</span>}</code></pre>
  `,
  styleUrl: './guide-code.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuideCodeComponent {
  readonly source = input.required<string>();
  readonly compact = input(false);
  readonly tokens = computed(() => tokenize(this.source()));
}

function tokenize(source: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let cursor = 0;

  for (const match of source.matchAll(TOKEN_PATTERN)) {
    const text = match[0];
    const index = match.index;
    if (index > cursor) {
      tokens.push({ text: source.slice(cursor, index), kind: 'plain' });
    }
    tokens.push({ text, kind: tokenKind(text) });
    cursor = index + text.length;
  }

  if (cursor < source.length) {
    tokens.push({ text: source.slice(cursor), kind: 'plain' });
  }
  return tokens;
}

function tokenKind(text: string): CodeTokenKind {
  if (text.startsWith('//')) return 'comment';
  if (text.startsWith('"') || text.startsWith("'")) return 'string';
  if (KEYWORDS.has(text)) return 'keyword';
  if (LITERALS.has(text)) return 'literal';
  if (/^\d/.test(text)) return 'number';
  if (/^[A-Za-z_$]/.test(text)) return 'function';
  if (OPERATORS.has(text)) return 'operator';
  return 'punctuation';
}
