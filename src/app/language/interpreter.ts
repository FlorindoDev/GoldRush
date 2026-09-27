import { GAME_BALANCE } from '../config/game-balance';
import { resolveProgram, type FunctionDefinition } from './program';
import { Expression, ScriptError, type ScriptObject, Statement, Value } from './syntax';
import { VectorQueueValue } from './collections/vector-queue';
import { VectorStackValue } from './collections/vector-stack';
import { VectorValue } from './collections/vector';

const MAX_EXECUTION_STEPS = GAME_BALANCE.scripting.maxExecutionSteps;
const YIELD_INTERVAL = GAME_BALANCE.scripting.yieldEverySteps;
const MAX_REPEAT_COUNT = GAME_BALANCE.scripting.maxRepeatCount;
const MAX_WAIT_MS = GAME_BALANCE.scripting.maxWaitMs;
const MAX_OUTPUT_LENGTH = GAME_BALANCE.scripting.maxOutputLength;
const BUILTIN_ARGUMENT_COUNTS: Record<string, number> = {
  print: 1,
  wait: 1,
  mine: 3,
  setCrypto: 2,
  progress: 0,
  vector: 0,
  stack: 0,
  queue: 0,
};
let nextParallelGroupId = 0;

export interface ScriptHost {
  globals?: Readonly<Record<string, Value>>;
  modules?: Readonly<Record<string, string>>;
  entryFileName?: string;
  print(message: string): void;
  mine?(
    gpus: Value | null,
    message: string | false | null,
    line: number,
    parallelGroupId?: number,
    progressEveryPercent?: number,
  ): Promise<void>;
  setCrypto?(gpus: Value, crypto: Value, line: number): void;
  progress(crypto?: string): number;
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
  onLine: (line: number, sourceName?: string) => void | Promise<void> = () => {},
): Promise<void> {
  const program = resolveProgram(
    source,
    host.modules,
    host.entryFileName,
    new Set(Object.keys(BUILTIN_ARGUMENT_COUNTS)),
  );
  await new Interpreter(host, signal, onLine, program.functions).run(program.statements);
}

class ReturnSignal {
  constructor(readonly value: Value) {}
}

interface InterpreterContext {
  scopes: Map<string, Value>[];
  globalNames: ReadonlySet<string>;
  steps: { count: number };
  sourceName?: string;
  callDepth: number;
  parallelGroupId?: number;
}

class Interpreter {
  private readonly scopes: Map<string, Value>[];
  private readonly globalNames: ReadonlySet<string>;
  private readonly steps: { count: number };
  private parallelGroupId?: number;
  private callDepth = 0;
  private sourceName?: string;

  constructor(
    private readonly host: ScriptHost,
    private readonly signal: AbortSignal,
    private readonly onLine: (line: number, sourceName?: string) => void | Promise<void>,
    private readonly functions: ReadonlyMap<string, FunctionDefinition>,
    context?: InterpreterContext,
  ) {
    const globals = host.globals ?? {};
    this.scopes = context?.scopes ?? [new Map(Object.entries(globals))];
    this.globalNames = context?.globalNames ?? new Set(Object.keys(globals));
    this.steps = context?.steps ?? { count: 0 };
    this.sourceName = context?.sourceName ?? host.entryFileName;
    this.callDepth = context?.callDepth ?? 0;
    this.parallelGroupId = context?.parallelGroupId;
  }

  private async checkExecutionLimit(line: number): Promise<void> {
    this.signal.throwIfAborted();
    if (++this.steps.count > MAX_EXECUTION_STEPS) {
      throw new ScriptError(
        `limite di ${MAX_EXECUTION_STEPS.toLocaleString('it-IT')} operazioni raggiunto. Controlla i cicli.`,
        line,
      );
    }
    // Cede periodicamente il controllo al browser: Stop resta utilizzabile anche nei cicli vuoti.
    if (this.steps.count % YIELD_INTERVAL === 0) {
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
    await this.onLine(statement.line, this.sourceName);
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
        const scope = statement.declare ? this.scopes.at(-1)! : this.variableScope(statement.name);
        if (!scope) {
          throw new ScriptError(
            `variabile "${statement.name}" non definita. Usa let.`,
            statement.line,
          );
        }
        scope.set(statement.name, await this.evaluateExpression(statement.value));
        break;
      }
      case 'return':
        if (this.callDepth === 0) {
          throw new ScriptError('return fuori da una funzione.', statement.line, this.sourceName);
        }
        throw new ReturnSignal(
          statement.value === null ? null : await this.evaluateExpression(statement.value),
        );
      case 'def':
      case 'import':
        throw new ScriptError(
          'def e import sono permessi solo al livello principale.',
          statement.line,
          this.sourceName,
        );
      case 'repeat': {
        const count = this.requireNumber(
          await this.evaluateExpression(statement.count),
          statement.line,
        );
        if (!Number.isInteger(count) || count < 0 || count > MAX_REPEAT_COUNT) {
          throw new ScriptError(
            `repeat richiede un intero tra 0 e ${MAX_REPEAT_COUNT}.`,
            statement.line,
          );
        }
        for (let i = 0; i < count; i++) {
          await this.checkExecutionLimit(statement.line);
          await this.run(statement.body);
        }
        break;
      }
      case 'parallel':
        await this.executeParallel(statement.body);
        break;
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

  private async executeParallel(statements: Statement[]): Promise<void> {
    const parallelGroupId = ++nextParallelGroupId;
    const results = await Promise.allSettled(
      statements.map(async (statement) => {
        await this.checkExecutionLimit(statement.line);
        if (statement.kind !== 'expression') {
          throw new ScriptError('parallel accetta solo comandi semplici.', statement.line);
        }
        const branch = new Interpreter(this.host, this.signal, this.onLine, this.functions, {
          scopes: [...this.scopes],
          globalNames: this.globalNames,
          steps: this.steps,
          sourceName: this.sourceName,
          callDepth: this.callDepth,
          parallelGroupId,
        });
        await branch.evaluateExpression(statement.expression);
      }),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      throw failure.reason;
    }
  }

  private variableScope(name: string): Map<string, Value> | undefined {
    const local = this.scopes.at(-1)!;
    if (local.has(name)) return local;
    const global = this.scopes[0];
    return global.has(name) ? global : undefined;
  }

  private async evaluateExpression(expression: Expression): Promise<Value> {
    await this.checkExecutionLimit(expression.line);
    switch (expression.kind) {
      case 'literal':
        return expression.value;
      case 'variable': {
        const value = this.variableScope(expression.name)?.get(expression.name);
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
        const definition = this.functions.get(expression.name);
        return definition
          ? this.callUserFunction(definition, args, expression.line)
          : this.callBuiltin(expression.name, args, expression.line);
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
        return await object.callMethod(
          expression.name,
          args,
          expression.line,
          this.parallelGroupId,
        );
      }
    }
  }

  private async callUserFunction(
    definition: FunctionDefinition,
    args: Value[],
    line: number,
  ): Promise<Value> {
    const { statement, sourceName } = definition;
    if (args.length !== statement.parameters.length) {
      throw new ScriptError(
        `${statement.name} richiede ${statement.parameters.length} argomenti.`,
        line,
        this.sourceName,
      );
    }
    if (this.callDepth >= GAME_BALANCE.scripting.maxNestingDepth) {
      throw new ScriptError('troppe chiamate di funzione annidate.', line, this.sourceName);
    }
    const previousSourceName = this.sourceName;
    this.sourceName = sourceName;
    this.callDepth++;
    this.scopes.push(new Map(statement.parameters.map((name, index) => [name, args[index]])));
    try {
      await this.run(statement.body);
      return null;
    } catch (error) {
      if (error instanceof ReturnSignal) return error.value;
      if (error instanceof ScriptError) error.sourceName ??= sourceName;
      throw error;
    } finally {
      this.scopes.pop();
      this.callDepth--;
      this.sourceName = previousSourceName;
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
    if (
      name === 'mine'
        ? args.length > 3
        : name === 'progress'
          ? args.length > 1
          : args.length !== expectedArguments
    ) {
      if (name === 'mine') {
        throw new ScriptError('mine accetta al massimo 3 argomenti.', line);
      }
      throw new ScriptError(`${name} richiede ${expectedArguments} argomenti.`, line);
    }
    switch (name) {
      case 'print':
        this.host.print(this.formatValue(args[0]).slice(0, MAX_OUTPUT_LENGTH));
        return 0;
      case 'progress':
        if (args.length === 1 && typeof args[0] !== 'string') {
          throw new ScriptError('progress richiede la sigla della cripto tra virgolette.', line);
        }
        return this.host.progress(args[0] as string | undefined);
      case 'setCrypto':
        if (!this.host.setCrypto) {
          throw new ScriptError('assegnazione cripto non disponibile.', line);
        }
        try {
          this.host.setCrypto(args[0], args[1], line);
        } catch (error) {
          if (error instanceof ScriptError) throw error;
          throw new ScriptError(
            error instanceof Error ? error.message : 'Assegnazione non riuscita.',
            line,
          );
        }
        return null;
      case 'mine':
        if (!this.host.mine) {
          throw new ScriptError('mining non disponibile in questo ambiente.', line);
        }
        let gpus: Value | null = null;
        let message: string | false | null = null;
        let progressEveryPercent: number | undefined;
        if (args.length === 1) {
          if (typeof args[0] === 'string' || args[0] === false) {
            message = args[0];
          } else if (typeof args[0] === 'number') {
            progressEveryPercent = this.requireMineProgressInterval(args[0], line);
          } else if (args[0] !== null && typeof args[0] === 'object') {
            gpus = args[0];
          } else {
            throw new ScriptError(
              'mine accetta un vettore di GPU, un messaggio, false o una percentuale.',
              line,
            );
          }
        } else if (args.length === 2 || args.length === 3) {
          if (args[0] === null || typeof args[0] !== 'object') {
            throw new ScriptError(
              'il primo argomento di mine deve essere un vettore di GPU.',
              line,
            );
          }
          gpus = args[0];
          if (typeof args[1] === 'number' && args.length === 2) {
            progressEveryPercent = this.requireMineProgressInterval(args[1], line);
          } else if (typeof args[1] === 'string' || args[1] === false) {
            message = args[1];
            if (args.length === 3) {
              if (typeof args[2] !== 'number') {
                throw new ScriptError('la frequenza di mine deve essere una percentuale.', line);
              }
              progressEveryPercent = this.requireMineProgressInterval(args[2], line);
            }
          } else {
            throw new ScriptError(
              'il secondo argomento di mine deve essere un messaggio, false o una percentuale.',
              line,
            );
          }
        }
        try {
          await this.host.mine(gpus, message, line, this.parallelGroupId, progressEveryPercent);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw error;
          }
          throw new ScriptError(
            error instanceof Error ? error.message : 'operazione di mining non riuscita.',
            line,
          );
        }
        return null;
      case 'vector':
        return new VectorValue();
      case 'stack':
        return new VectorStackValue();
      case 'queue':
        return new VectorQueueValue();
      case 'wait': {
        const time = this.requireNumber(args[0], line);
        if (time < 0 || time > MAX_WAIT_MS) {
          throw new ScriptError(`wait richiede millisecondi tra 0 e ${MAX_WAIT_MS}.`, line);
        }
        await delay(time, this.signal);
        return 0;
      }
      default:
        return 0;
    }
  }

  private requireMineProgressInterval(value: number, line: number): number {
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      throw new ScriptError(
        'la percentuale di mine deve essere maggiore di 0 e non superiore a 100.',
        line,
      );
    }
    return value;
  }

  private formatValue(value: Value): string {
    return typeof value === 'object' && value !== null ? value.toDisplayString() : String(value);
  }
}
