import { parse } from './parser';
import { Expression, ScriptError, type ScriptObject, Statement, Value } from './syntax';
import { VectorQueueValue } from './collections/vector-queue';
import { VectorStackValue } from './collections/vector-stack';
import { VectorValue } from './collections/vector';

const MAX_EXECUTION_STEPS = 10_000;
const YIELD_INTERVAL = 50;
const MAX_REPEAT_COUNT = 1000;
const MAX_WAIT_MS = 5000;
const MAX_OUTPUT_LENGTH = 2000;
const BUILTIN_ARGUMENT_COUNTS: Record<string, number> = {
  print: 1,
  wait: 1,
  progress: 0,
  vector: 0,
  stack: 0,
  queue: 0,
};

export interface ScriptHost {
  globals?: Readonly<Record<string, Value>>;
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
  onLine: (line: number) => void | Promise<void> = () => {},
): Promise<void> {
  const program = parse(source);
  await new Interpreter(host, signal, onLine).run(program);
}

class Interpreter {
  private readonly variables: Map<string, Value>;
  private readonly globalNames: ReadonlySet<string>;
  private steps = 0;

  constructor(
    private readonly host: ScriptHost,
    private readonly signal: AbortSignal,
    private readonly onLine: (line: number) => void | Promise<void>,
  ) {
    const globals = host.globals ?? {};
    this.variables = new Map(Object.entries(globals));
    this.globalNames = new Set(Object.keys(globals));
  }

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
    await this.onLine(statement.line);
    switch (statement.kind) {
      case 'expression':
        await this.evaluateExpression(statement.expression);
        break;
      case 'assign': {
        if (this.globalNames.has(statement.name)) {
          throw new ScriptError(
            `la variabile di sistema "${statement.name}" non è modificabile.`,
            statement.line,
          );
        }
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
      case 'member': {
        const object = this.requireScriptObject(
          await this.evaluateExpression(expression.object),
          expression.line,
        );
        if (expression.name === 'type') {
          return object.objectType;
        }
        return object.getAttribute(expression.name, expression.line);
      }
      case 'index': {
        const object = await this.evaluateExpression(expression.object);
        if (!this.isIndexable(object)) {
          throw new ScriptError('solo i vettori possono essere indicizzati.', expression.line);
        }
        const index = this.requireNumber(
          await this.evaluateExpression(expression.index),
          expression.line,
        );
        return object.getItem(index, expression.line);
      }
      case 'method-call': {
        const object = this.requireScriptObject(
          await this.evaluateExpression(expression.object),
          expression.line,
        );
        const args: Value[] = [];
        for (const arg of expression.args) {
          args.push(await this.evaluateExpression(arg));
        }
        return await object.callMethod(expression.name, args, expression.line);
      }
    }
  }

  private requireScriptObject(value: Value, line: number): ScriptObject {
    if (typeof value !== 'object' || value === null) {
      throw new ScriptError('attributi e metodi richiedono un oggetto.', line);
    }
    return value;
  }

  private isIndexable(
    value: Value,
  ): value is ScriptObject & { getItem(index: number, line: number): Value } {
    return typeof value === 'object' && value !== null && 'getItem' in value;
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
      return `${this.formatValue(left)}${this.formatValue(right)}`.slice(0, MAX_OUTPUT_LENGTH);
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
      case 'print':
        this.host.print(this.formatValue(args[0]).slice(0, MAX_OUTPUT_LENGTH));
        return 0;
      case 'progress':
        return this.host.progress();
      case 'vector':
        return new VectorValue();
      case 'stack':
        return new VectorStackValue();
      case 'queue':
        return new VectorQueueValue();
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

  private formatValue(value: Value): string {
    return typeof value === 'object' && value !== null ? value.toDisplayString() : String(value);
  }
}
