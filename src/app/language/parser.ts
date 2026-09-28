import { GAME_BALANCE } from '../config/game-balance';
import { tokenize } from './lexer';
import { Expression, ScriptError, Statement, Token } from './syntax';

const MAX_NESTING_DEPTH = GAME_BALANCE.scripting.maxNestingDepth;
const UNARY_PRECEDENCE = 7;
const RESERVED_WORDS = [
  'true',
  'false',
  'null',
  'let',
  'if',
  'else',
  'for',
  'while',
  'repeat',
  'parallel',
  'def',
  'return',
  'import',
  'from',
];

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
      if (this.match('def')) {
        const name = this.readName('funzione');
        this.expect('(');
        const parameters: string[] = [];
        if (!this.match(')')) {
          do {
            const parameter = this.readName('parametro');
            if (parameters.includes(parameter)) {
              throw new ScriptError(`parametro "${parameter}" duplicato.`, line);
            }
            parameters.push(parameter);
          } while (this.match(','));
          this.expect(')');
        }
        return { kind: 'def', name, parameters, body: this.parseBlock(), line };
      }
      if (this.match('import')) {
        let names: string[] | null = null;
        if (this.match('{')) {
          names = [];
          do {
            const name = this.readName('funzione');
            if (names.includes(name)) {
              throw new ScriptError(`funzione "${name}" importata due volte.`, line);
            }
            names.push(name);
          } while (this.match(','));
          this.expect('}');
          this.expect('from');
        } else if (this.match('*')) {
          this.expect('from');
        }
        const file = this.parseExpression();
        if (file.kind !== 'literal' || typeof file.value !== 'string') {
          throw new ScriptError('import richiede il nome del file tra virgolette.', line);
        }
        this.expect(';');
        return { kind: 'import', fileName: file.value, names, line };
      }
      if (this.match('return')) {
        const value = this.current.text === ';' ? null : this.parseExpression();
        this.expect(';');
        return { kind: 'return', value, line };
      }
      if (this.match('parallel')) {
        const body = this.parseBlock();
        if (body.some((statement) => statement.kind !== 'expression')) {
          throw new ScriptError(
            'parallel accetta solo comandi semplici, come mine();. Dichiara le variabili prima del blocco.',
            line,
          );
        }
        return { kind: 'parallel', body, line };
      }
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
    const sharedDeclaration = this.current.text === 'let';
    const initializers = this.parseForClause(sharedDeclaration);
    this.expect(';');
    const condition = this.parseExpression();
    this.expect(';');
    const increments = this.parseForClause();
    this.expect(')');
    const body = this.parseBlock();

    return { kind: 'for', initializers, condition, increments, body, line };
  }

  private parseForClause(sharedDeclaration = false): Statement[] {
    const statements = [this.parseSimpleStatement()];
    while (this.match(',')) {
      statements.push(this.parseSimpleStatement(sharedDeclaration));
    }
    return statements;
  }

  private readName(kind: string): string {
    const token = this.advance();
    if (token.kind !== 'word' || RESERVED_WORDS.includes(token.text)) {
      throw new ScriptError(`nome di ${kind} non valido.`, token.line);
    }
    return token.text;
  }

  private parseSimpleStatement(declareFromFor = false): Statement {
    const line = this.current.line;
    const declare = declareFromFor || this.match('let');
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
    let expression: Expression;
    if (token.kind === 'number') {
      expression = { kind: 'literal', value: Number(text), line };
    } else if (token.kind === 'string') {
      const value = text
        .slice(1, -1)
        .replace(
          /\\(["'\\nt])/g,
          (_, escaped: string) => ({ n: '\n', t: '\t' })[escaped] ?? escaped,
        );
      expression = { kind: 'literal', value, line };
    } else if (text === 'true' || text === 'false' || text === 'null') {
      expression = {
        kind: 'literal',
        value: text === 'null' ? null : text === 'true',
        line,
      };
    } else if (text === '!' || text === '-') {
      expression = {
        kind: 'unary',
        operator: text,
        operand: this.parseExpression(UNARY_PRECEDENCE),
        line,
      };
    } else if (text === '(') {
      expression = this.parseExpression();
      this.expect(')');
    } else if (token.kind === 'word') {
      expression = { kind: 'variable', name: text, line };
    } else {
      throw new ScriptError('espressione non valida.', line);
    }

    return this.parsePostfixExpression(expression);
  }

  private parsePostfixExpression(initial: Expression): Expression {
    let expression = initial;
    let postfixCount = 0;

    while (true) {
      if (this.match('.')) {
        this.checkPostfixDepth(++postfixCount);
        const member = this.advance();
        if (member.kind !== 'word') {
          throw new ScriptError('atteso il nome di un attributo.', member.line);
        }
        expression = this.match('(')
          ? {
              kind: 'method-call',
              object: expression,
              name: member.text,
              args: this.parseCallArguments(),
              line: member.line,
            }
          : { kind: 'member', object: expression, name: member.text, line: member.line };
        continue;
      }

      if (this.match('[')) {
        this.checkPostfixDepth(++postfixCount);
        const index = this.parseExpression();
        this.expect(']');
        expression = { kind: 'index', object: expression, index, line: index.line };
        continue;
      }

      if (this.match('(')) {
        this.checkPostfixDepth(++postfixCount);
        if (expression.kind !== 'variable') {
          throw new ScriptError('puoi chiamare solo funzioni nominate.', this.current.line);
        }
        expression = {
          kind: 'call',
          name: expression.name,
          args: this.parseCallArguments(),
          line: expression.line,
        };
        continue;
      }

      return expression;
    }
  }

  private parseCallArguments(): Expression[] {
    const args: Expression[] = [];
    if (!this.match(')')) {
      do {
        args.push(this.parseExpression());
      } while (this.match(','));
      this.expect(')');
    }
    return args;
  }

  private checkPostfixDepth(depth: number): void {
    if (depth > MAX_NESTING_DEPTH) {
      throw new ScriptError('troppi attributi o indici concatenati.', this.current.line);
    }
  }
}
