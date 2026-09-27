export interface ScriptObject {
  readonly objectType: string;
  getAttribute(name: string, line: number): Value;
  callMethod(
    name: string,
    args: Value[],
    line: number,
    parallelGroupId?: number,
  ): Value | Promise<Value>;
  toDisplayString(): string;
}

export interface ScriptIndexable extends ScriptObject {
  getItem(index: number, line: number): Value;
}

export type Value = number | string | boolean | null | ScriptObject;
export interface Token {
  kind: 'number' | 'string' | 'word' | 'symbol' | 'eof';
  text: string;
  line: number;
}
export type Expression =
  | { kind: 'literal'; value: Value; line: number }
  | { kind: 'variable'; name: string; line: number }
  | { kind: 'call'; name: string; args: Expression[]; line: number }
  | { kind: 'member'; object: Expression; name: string; line: number }
  | { kind: 'index'; object: Expression; index: Expression; line: number }
  | {
      kind: 'method-call';
      object: Expression;
      name: string;
      args: Expression[];
      line: number;
    }
  | { kind: 'unary'; operator: string; operand: Expression; line: number }
  | { kind: 'binary'; operator: string; left: Expression; right: Expression; line: number };
export type Statement =
  | { kind: 'expression'; expression: Expression; line: number }
  | { kind: 'assign'; name: string; value: Expression; declare: boolean; line: number }
  | { kind: 'def'; name: string; parameters: string[]; body: Statement[]; line: number }
  | { kind: 'return'; value: Expression | null; line: number }
  | { kind: 'import'; fileName: string; names: string[] | null; line: number }
  | { kind: 'repeat'; count: Expression; body: Statement[]; line: number }
  | { kind: 'parallel'; body: Statement[]; line: number }
  | { kind: 'while'; condition: Expression; body: Statement[]; line: number }
  | {
      kind: 'for';
      initializer: Statement;
      condition: Expression;
      increment: Statement;
      body: Statement[];
      line: number;
    }
  | { kind: 'if'; condition: Expression; body: Statement[]; otherwise: Statement[]; line: number };

export class ScriptError extends Error {
  constructor(
    message: string,
    readonly line: number,
    public sourceName?: string,
  ) {
    super(`Riga ${line}: ${message}`);
  }
}
