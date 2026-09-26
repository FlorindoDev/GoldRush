import { GAME_BALANCE } from '../config/game-balance';
import { ScriptError, Token } from './syntax';

const MAX_SOURCE_LENGTH = GAME_BALANCE.scripting.maxSourceLength;
const TOKEN_KINDS = ['number', 'string', 'word', 'symbol'] as const;
const TOKEN_PATTERNS = [
  /(?<space>\s+)/,
  /(?<comment>\/\/[^\n]*)/,
  /(?<blockComment>\/\*[\s\S]*?\*\/)/,
  /(?<number>\d+(?:\.\d+)?)/,
  /(?<string>"(?:[^"\\\n]|\\["\\nt])*"|'(?:[^'\\\n]|\\['\\nt])*')/,
  /(?<word>[a-zA-Z_][a-zA-Z_0-9]*)/,
  /(?<symbol>==|!=|<=|>=|\+\+|--|&&|\|\||[{}();,.\[\]+\-*/%<>=!])/,
];

export function tokenize(source: string): Token[] {
  if (source.length > MAX_SOURCE_LENGTH) {
    throw new ScriptError(
      `programma troppo lungo (massimo ${MAX_SOURCE_LENGTH.toLocaleString('it-IT')} caratteri).`,
      1,
    );
  }
  const tokens: Token[] = [];
  // "y" impedisce di saltare caratteri non validi tra due token.
  const pattern = new RegExp(TOKEN_PATTERNS.map((token) => token.source).join('|'), 'gy');
  let position = 0;
  let line = 1;
  while (position < source.length) {
    if (source.startsWith('/*', position) && source.indexOf('*/', position + 2) < 0) {
      throw new ScriptError('commento lungo non chiuso.', line);
    }
    pattern.lastIndex = position;
    const match = pattern.exec(source);
    if (!match) {
      throw new ScriptError(`carattere non riconosciuto: ${source[position]}`, line);
    }
    const groups = match.groups!;
    if (!groups['space'] && !groups['comment'] && !groups['blockComment']) {
      const kind = TOKEN_KINDS.find((key) => groups[key] !== undefined)!;
      tokens.push({ kind, text: match[0], line });
    }
    line += (match[0].match(/\n/g) ?? []).length;
    position = pattern.lastIndex;
  }
  tokens.push({ kind: 'eof', text: '', line });
  return tokens;
}
