import { parse } from './parser';
import { Expression, ScriptError, Statement, Value } from './syntax';

const MAX_EXECUTION_STEPS = 10_000;
const YIELD_INTERVAL = 50;
const MAX_REPEAT_COUNT = 1000;
const MAX_WAIT_MS = 5000;
const MAX_OUTPUT_LENGTH = 2000;
const BUILTIN_ARGUMENT_COUNTS: Record<string, number> = {
  mine: 0,
  print: 1,
  wait: 1,
  progress: 0,
};

export interface ScriptHost {
  mine(signal: AbortSignal): Promise<void>;
  print(message: string): void;
  progress(): number;
}

export function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function execute(
  source: string,
  host: ScriptHost,
  signal: AbortSignal,
  onLine: (line: number) => void = () => {},
): Promise<void> {
  const program = parse(source);
  await new Interpreter(host, signal, onLine).run(program);
}

class Interpreter {
  private readonly variables = new Map<string, Value>();
  private steps = 0;

  constructor(
    private readonly host: ScriptHost,
    private readonly signal: AbortSignal,
    private readonly onLine: (line: number) => void,
  ) {}

  private async checkExecutionLimit(line: number): Promise<void> {
    this.signal.throwIfAborted();
    if (++this.steps > MAX_EXECUTION_STEPS) {
      throw new ScriptError('limite di 10.000 operazioni raggiunto. Controlla i cicli.', line);
    }
    // Cede periodicamente il controllo al browser: Stop resta utilizzabile anche nei cicli vuoti.
    if (this.steps % YIELD_INTERVAL === 0) {
      await delay(0, this.signal);
    }
  }

  async run(statements: Statement[]): Promise<void> {
    for (const statement of statements) {
      await this.executeStatement(statement);
    }
  }

  private async executeStatement(statement: Statement): Promise<void> {
    await this.checkExecutionLimit(statement.line);
    this.onLine(statement.line);
    switch (statement.kind) {
      case 'expression':
        await this.evaluateExpression(statement.expression);
        break;
      case 'assign': {
        if (!statement.declare && !this.variables.has(statement.name)) {
          throw new ScriptError(
            `variabile "${statement.name}" non definita. Usa let.`,
            statement.line,
          );
        }
        this.variables.set(statement.name, await this.evaluateExpression(statement.value));
        break;
      }
      case 'repeat': {
        const count = this.requireNumber(
          await this.evaluateExpression(statement.count),
          statement.line,
        );
        if (!Number.isInteger(count) || count < 0 || count > MAX_REPEAT_COUNT) {
          throw new ScriptError('repeat richiede un intero tra 0 e 1000.', statement.line);
        }
        for (let i = 0; i < count; i++) {
          await this.checkExecutionLimit(statement.line);
          await this.run(statement.body);
        }
        break;
      }
      case 'while':
        while (await this.evaluateExpression(statement.condition)) {
          await this.checkExecutionLimit(statement.line);
          await this.run(statement.body);
        }
        break;
      case 'for':
        await this.executeStatement(statement.initializer);
        while (await this.evaluateExpression(statement.condition)) {
          await this.checkExecutionLimit(statement.line);
          await this.run(statement.body);
          await this.executeStatement(statement.increment);
        }
        break;
      case 'if':
        await this.run(
          (await this.evaluateExpression(statement.condition))
            ? statement.body
            : statement.otherwise,
        );
        break;
    }
  }

  private async evaluateExpression(expression: Expression): Promise<Value> {
    await this.checkExecutionLimit(expression.line);
    switch (expression.kind) {
      case 'literal':
        return expression.value;
      case 'variable': {
        const value = this.variables.get(expression.name);
        if (value === undefined) {
          throw new ScriptError(`variabile "${expression.name}" non definita.`, expression.line);
        }
        return value;
      }
      case 'unary': {
        const operand = await this.evaluateExpression(expression.operand);
        return expression.operator === '!'
          ? !operand
          : -this.requireNumber(operand, expression.line);
      }
      case 'binary': {
        const left = await this.evaluateExpression(expression.left);
        if (expression.operator === '&&' && !left) {
          return false;
        }
        if (expression.operator === '||' && left) {
          return true;
        }
        return this.applyBinaryOperator(
          expression.operator,
          left,
          await this.evaluateExpression(expression.right),
          expression.line,
        );
      }
      case 'call': {
        const args: Value[] = [];
        for (const arg of expression.args) {
          args.push(await this.evaluateExpression(arg));
        }
        return this.callBuiltin(expression.name, args, expression.line);
      }
    }
  }

  private requireNumber(value: Value, line: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ScriptError('atteso un numero finito.', line);
    }
    return value;
  }

  private applyBinaryOperator(operator: string, left: Value, right: Value, line: number): Value {
    if (operator === '==') {
      return left === right;
    }
    if (operator === '!=') {
      return left !== right;
    }
    if (operator === '&&') {
      return Boolean(left && right);
    }
    if (operator === '||') {
      return Boolean(left || right);
    }
    if (operator === '+' && (typeof left === 'string' || typeof right === 'string')) {
      return `${left}${right}`.slice(0, MAX_OUTPUT_LENGTH);
    }
    const a = this.requireNumber(left, line);
    const b = this.requireNumber(right, line);
    if ((operator === '/' || operator === '%') && b === 0) {
      throw new ScriptError('divisione per zero.', line);
    }
    let result: Value;
    switch (operator) {
      case '+':
        result = a + b;
        break;
      case '-':
        result = a - b;
        break;
      case '*':
        result = a * b;
        break;
      case '/':
        result = a / b;
        break;
      case '%':
        result = a % b;
        break;
      case '<':
        return a < b;
      case '>':
        return a > b;
      case '<=':
        return a <= b;
      case '>=':
        return a >= b;
      default:
        throw new ScriptError('operatore sconosciuto.', line);
    }
    return this.requireNumber(result, line);
  }

  private async callBuiltin(name: string, args: Value[], line: number): Promise<Value> {
    if (!Object.hasOwn(BUILTIN_ARGUMENT_COUNTS, name)) {
      throw new ScriptError(`funzione "${name}" sconosciuta.`, line);
    }
    const expectedArguments = BUILTIN_ARGUMENT_COUNTS[name];
    if (args.length !== expectedArguments) {
      throw new ScriptError(`${name} richiede ${expectedArguments} argomenti.`, line);
    }
    switch (name) {
      case 'mine':
        try {
          await this.host.mine(this.signal);
        } catch (error) {
          this.signal.throwIfAborted();
          throw new ScriptError(
            error instanceof Error ? error.message : 'mining non riuscito.',
            line,
          );
        }
        return 0;
      case 'print':
        this.host.print(String(args[0]).slice(0, MAX_OUTPUT_LENGTH));
        return 0;
      case 'progress':
        return this.host.progress();
      case 'wait': {
        const time = this.requireNumber(args[0], line);
        if (time < 0 || time > MAX_WAIT_MS) {
          throw new ScriptError('wait richiede millisecondi tra 0 e 5000.', line);
        }
        await delay(time, this.signal);
        return 0;
      }
      default:
        return 0;
    }
  }
}
