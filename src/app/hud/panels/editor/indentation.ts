export interface LineBraces {
  opening: number;
  closing: number;
  leadingClosings: number;
  insideBlockComment: boolean;
}

export function countLineBraces(line: string, startsInsideBlockComment = false): LineBraces {
  let opening = 0;
  let closing = 0;
  let leadingClosings = 0;
  let leading = true;
  let quote: '"' | "'" | null = null;
  let insideBlockComment = startsInsideBlockComment;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];

    if (insideBlockComment) {
      if (character === '*' && line[index + 1] === '/') {
        insideBlockComment = false;
        index++;
      }
      continue;
    }

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
    if (character === '/' && line[index + 1] === '*') {
      insideBlockComment = true;
      index++;
      continue;
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

  return { opening, closing, leadingClosings, insideBlockComment };
}

export function autoIndent(source: string, indentation = '  '): string {
  let depth = 0;
  let insideBlockComment = false;

  return source
    .split('\n')
    .map((line) => {
      const content = line.trim();
      if (!content) {
        return '';
      }

      const braces = countLineBraces(line, insideBlockComment);
      insideBlockComment = braces.insideBlockComment;
      const lineDepth = Math.max(0, depth - braces.leadingClosings);
      depth = Math.max(0, depth + braces.opening - braces.closing);

      return indentation.repeat(lineDepth) + content;
    })
    .join('\n');
}
