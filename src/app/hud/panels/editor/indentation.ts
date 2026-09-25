export interface LineBraces {
  opening: number;
  closing: number;
  leadingClosings: number;
}

export function countLineBraces(line: string): LineBraces {
  let opening = 0;
  let closing = 0;
  let leadingClosings = 0;
  let leading = true;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];

    if (quote) {
      if (character === '\\') {
        index++;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '/' && line[index + 1] === '/') {
      break;
    }
    if (character === '"' || character === "'") {
      quote = character;
      leading = false;
      continue;
    }
    if (character.trim() === '' && leading) {
      continue;
    }
    if (character === '}' && leading) {
      leadingClosings++;
      closing++;
      continue;
    }

    leading = false;
    if (character === '{') {
      opening++;
    } else if (character === '}') {
      closing++;
    }
  }

  return { opening, closing, leadingClosings };
}

export function autoIndent(source: string, indentation = '  '): string {
  let depth = 0;

  return source
    .split('\n')
    .map((line) => {
      const content = line.trim();
      if (!content) {
        return '';
      }

      const braces = countLineBraces(line);
      const lineDepth = Math.max(0, depth - braces.leadingClosings);
      depth = Math.max(0, depth + braces.opening - braces.closing);

      return indentation.repeat(lineDepth) + content;
    })
    .join('\n');
}
