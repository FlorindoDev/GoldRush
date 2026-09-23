import { tokenize } from './lexer';
import { Expression, ScriptError, Statement, Token } from './syntax';

const MAX_NESTING_DEPTH = 64;
const UNARY_PRECEDENCE = 7;
const RESERVED_WORDS = ['true', 'false', 'let', 'if', 'else', 'for', 'while', 'repeat'];

const PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '>': 4,
  '<=': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

export function parse(source: string): Statement[] {
  return new Parser(tokenize(source)).parse();
}

class Parser {
  private cursor = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Statement[] {
    const statements: Statement[] = [];
    while (this.current.kind !== 'eof') {
      statements.push(this.parseStatement());
    }
    return statements;
  }

  private get current(): Token {
    return this.tokens[this.cursor];
  }

  private advance(): Token {
    return this.tokens[this.cursor++];
  }

  private match(text: string): boolean {
    if (this.current.text !== text) {
      return false;
    }
    this.advance();
    return true;
  }

  private expect(text: string): void {
    if (!this.match(text)) {
      throw new ScriptError(`atteso "${text}".`, this.current.line);
    }
  }

  private withNestingLimit<T>(read: () => T): T {
    if (++this.depth > MAX_NESTING_DEPTH) {
      throw new ScriptError('troppi livelli di annidamento.', this.current.line);
    }
    try {
      return read();
    } finally {
      this.depth--;
    }
  }

  private parseStatement(): Statement {
    return this.withNestingLimit(() => {
      const { text, line } = this.current;
      if (text === 'repeat' || text === 'while' || text === 'if') {
        this.advance();
        this.expect('(');
        const value = this.parseExpression();
        this.expect(')');
        const body = this.parseBlock();
        if (text === 'repeat') {
          return { kind: text, count: value, body, line };
        }
        if (text === 'while') {
          return { kind: text, condition: value, body, line };
        }
        const otherwise = this.match('else') ? this.parseBlock() : [];
        return { kind: 'if', condition: value, body, otherwise, line };
      }
      if (this.match('for')) {
        return this.parseForStatement(line);
      }
      const result = this.parseSimpleStatement();
      this.expect(';');
      return result;
    });
  }

  private parseForStatement(line: number): Statement {
    this.expect('(');
    const initializer = this.parseSimpleStatement();
    this.expect(';');
    const condition = this.parseExpression();
    this.expect(';');
    const increment = this.parseSimpleStatement();
    this.expect(')');
    const body = this.parseBlock();

    return { kind: 'for', initializer, condition, increment, body, line };
  }

  private parseSimpleStatement(): Statement {
    const line = this.current.line;
    const declare = this.match('let');
    if (
      declare ||
      (this.current.kind === 'word' &&
        ['=', '++', '--'].includes(this.tokens[this.cursor + 1].text))
    ) {
      const name = this.advance();
      if (name.kind !== 'word' || RESERVED_WORDS.includes(name.text)) {
        throw new ScriptError('nome di variabile non valido.', line);
      }
      const operator = this.advance().text;
      let value: Expression;
      if (operator === '=') {
        value = this.parseExpression();
      } else if (!declare && (operator === '++' || operator === '--')) {
        value = {
          kind: 'binary',
          operator: operator[0],
          left: { kind: 'variable', name: name.text, line },
          right: { kind: 'literal', value: 1, line },
          line,
        };
      } else {
        throw new ScriptError('atteso "=".', line);
      }
      return { kind: 'assign', name: name.text, declare, value, line };
    }
    return { kind: 'expression', expression: this.parseExpression(), line };
  }

  private parseBlock(): Statement[] {
    this.expect('{');
    const body: Statement[] = [];
    while (!this.match('}')) {
      if (this.current.kind === 'eof') {
        throw new ScriptError('manca la parentesi "}".', this.current.line);
      }
      body.push(this.parseStatement());
    }
    return body;
  }

  private parseExpression(minimum = 0): Expression {
    return this.withNestingLimit(() => {
      let left = this.parsePrimaryExpression();
      while ((PRECEDENCE[this.current.text] ?? -1) >= minimum) {
        const { text: operator, line } = this.advance();
        const right = this.parseExpression(PRECEDENCE[operator] + 1);
        left = { kind: 'binary', operator, left, right, line };
      }
      return left;
    });
  }

  private parsePrimaryExpression(): Expression {
    const token = this.advance();
    const { text, line } = token;
    if (token.kind === 'number') {
      return { kind: 'literal', value: Number(text), line };
    }
    if (token.kind === 'string') {
      const value = text
        .slice(1, -1)
        .replace(
          /\\(["'\\nt])/g,
          (_, escaped: string) => ({ n: '\n', t: '\t' })[escaped] ?? escaped,
        );
      return { kind: 'literal', value, line };
    }
    if (text === 'true' || text === 'false') {
      return { kind: 'literal', value: text === 'true', line };
    }
    if (text === '!' || text === '-') {
      return {
        kind: 'unary',
        operator: text,
        operand: this.parseExpression(UNARY_PRECEDENCE),
        line,
      };
    }
    if (text === '(') {
      const value = this.parseExpression();
      this.expect(')');
      return value;
    }
    if (token.kind === 'word') {
      if (!this.match('(')) {
        return { kind: 'variable', name: text, line };
      }
      const args: Expression[] = [];
      if (!this.match(')')) {
        do {
          args.push(this.parseExpression());
        } while (this.match(','));
        this.expect(')');
      }
      return { kind: 'call', name: text, args, line };
    }
    throw new ScriptError('espressione non valida.', line);
  }
}
