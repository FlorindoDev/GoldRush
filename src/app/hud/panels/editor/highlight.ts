const HIGHLIGHT_PATTERNS = [
  /\/\/[^\n]*/,
  /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
  /\b(?:repeat|for|while|if|else|let|true|false)\b/,
  /\b(?:mine|print|wait|progress)(?=\s*\()/,
  /\b\d+(?:\.\d+)?\b/,
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface HighlightOptions {
  executedLines?: ReadonlyMap<number, number>;
  effectsEnabled?: boolean;
  activeLine?: number;
  errorLine?: number;
  cursorLine?: number;
}

export function highlight(source: string, options: HighlightOptions = {}): string {
  return source
    .split('\n')
    .map((line, index) => highlightLine(line, index + 1, options))
    .join('');
}

function highlightLine(line: string, lineNumber: number, options: HighlightOptions): string {
  const pattern = new RegExp(HIGHLIGHT_PATTERNS.map((token) => token.source).join('|'), 'g');
  let cursor = 0;
  let html = '';
  for (const match of line.matchAll(pattern)) {
    const token = match[0];
    html += escapeHtml(line.slice(cursor, match.index));
    const className = getTokenClass(token);
    html += `<span class="${className}">${escapeHtml(token)}</span>`;
    cursor = match.index! + token.length;
  }
  html += escapeHtml(line.slice(cursor));
  html ||= '&nbsp;';

  const executionId =
    options.effectsEnabled === false ? undefined : options.executedLines?.get(lineNumber);
  const classes = ['code-line'];
  if (lineNumber === options.cursorLine) {
    classes.push('cursor-line');
  }
  if (lineNumber === options.activeLine) {
    classes.push('active-line');
  }
  if (lineNumber === options.errorLine) {
    classes.push('error-line');
  }
  if (executionId !== undefined) {
    classes.push('executed-line');
    classes.push(`execution-${executionId}`);
  }
  return `<span class="${classes.join(' ')}"><span class="line-number">${lineNumber}</span><span class="line-content">${html}</span></span>`;
}

function getTokenClass(token: string): string {
  if (token.startsWith('//')) {
    return 'token-comment';
  }
  if (/^['"]/.test(token)) {
    return 'token-string';
  }
  if (/^\d/.test(token)) {
    return 'token-number';
  }
  if (/^(mine|print|wait|progress)$/.test(token)) {
    return 'token-function';
  }
  return 'token-keyword';
}
