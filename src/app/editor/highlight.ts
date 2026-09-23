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

export function highlight(source: string): string {
  const pattern = new RegExp(HIGHLIGHT_PATTERNS.map((token) => token.source).join('|'), 'g');
  let cursor = 0;
  let html = '';
  for (const match of source.matchAll(pattern)) {
    const token = match[0];
    html += escapeHtml(source.slice(cursor, match.index));
    const className = getTokenClass(token);
    html += `<span class="${className}">${escapeHtml(token)}</span>`;
    cursor = match.index! + token.length;
  }
  return html + escapeHtml(source.slice(cursor)) + '\n';
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
