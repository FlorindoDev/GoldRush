import { countLineBraces } from './indentation';

const HIGHLIGHT_PATTERNS = [
  /\/\/[^\n]*/,
  /\/\*/,
  /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
  /\b(?:parallel|repeat|for|while|if|else|let|def|return|import|from|true|false)\b/,
  /\.[a-zA-Z_][a-zA-Z_0-9]*(?=\s*\()/,
  /\b[a-zA-Z_][a-zA-Z_0-9]*(?=\s*\()/,
  /\.[a-zA-Z_][a-zA-Z_0-9]*/,
  /\b[a-zA-Z_][a-zA-Z_0-9]*\b/,
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
  let blockDepth = 0;
  let insideBlockComment = false;

  return source
    .split('\n')
    .map((line, index) => {
      const html = highlightLine(line, index + 1, options, blockDepth, insideBlockComment);
      const braces = countLineBraces(line, insideBlockComment);
      blockDepth = Math.max(0, blockDepth + braces.opening - braces.closing);
      insideBlockComment = braces.insideBlockComment;
      return html;
    })
    .join('');
}

function highlightLine(
  line: string,
  lineNumber: number,
  options: HighlightOptions,
  blockDepth: number,
  startsInsideBlockComment: boolean,
): string {
  const pattern = new RegExp(HIGHLIGHT_PATTERNS.map((token) => token.source).join('|'), 'g');
  let cursor = 0;
  let html = '';
  let insideBlockComment = startsInsideBlockComment;

  while (cursor < line.length) {
    if (insideBlockComment) {
      const closingIndex = line.indexOf('*/', cursor);
      if (closingIndex < 0) {
        html += commentMarkup(line.slice(cursor));
        cursor = line.length;
        break;
      }
      const commentEnd = closingIndex + 2;
      html += commentMarkup(line.slice(cursor, commentEnd));
      cursor = commentEnd;
      insideBlockComment = false;
      continue;
    }

    pattern.lastIndex = cursor;
    const match = pattern.exec(line);
    if (!match) {
      break;
    }

    const token = match[0];
    const tokenStart = match.index;
    html += escapeHtml(line.slice(cursor, tokenStart));
    if (token === '/*') {
      const closingIndex = line.indexOf('*/', tokenStart + token.length);
      if (closingIndex < 0) {
        html += commentMarkup(line.slice(tokenStart));
        cursor = line.length;
        insideBlockComment = true;
        break;
      }
      const commentEnd = closingIndex + 2;
      html += commentMarkup(line.slice(tokenStart, commentEnd));
      cursor = commentEnd;
      continue;
    }

    if (token.startsWith('//')) {
      html += commentMarkup(line.slice(tokenStart));
      cursor = line.length;
      break;
    }

    const followsCall = /^\s*\(/.test(line.slice(match.index! + token.length));
    const className = getTokenClass(token, followsCall);
    html += `<span class="${className}">${escapeHtml(token)}</span>`;
    cursor = tokenStart + token.length;
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
  const guides = Array.from(
    { length: blockDepth },
    (_, index) =>
      `<i class="block-guide" style="left:calc(var(--editor-code-left) + ${(index + 1) * 2}ch)"></i>`,
  ).join('');
  const guideMarkup = guides
    ? `<span class="block-guides" aria-hidden="true">${guides}</span>`
    : '';
  return (
    `<span class="${classes.join(' ')}">` +
    `<span class="line-number">${lineNumber}</span>` +
    `<span class="line-content">${guideMarkup}${html}</span></span>`
  );
}

function commentMarkup(text: string): string {
  return `<span class="token-comment">${escapeHtml(text)}</span>`;
}

function getTokenClass(token: string, followsCall: boolean): string {
  if (token.startsWith('//')) {
    return 'token-comment';
  }
  if (/^['"]/.test(token)) {
    return 'token-string';
  }
  if (/^\d/.test(token)) {
    return 'token-number';
  }
  if (token.startsWith('.')) {
    return followsCall ? 'token-function' : 'token-member';
  }
  if (/^(parallel|repeat|for|while|if|else|let|def|return|import|from|true|false)$/.test(token)) {
    return 'token-keyword';
  }
  if (followsCall) {
    return 'token-function';
  }
  return 'token-variable';
}
