export type Value = number | string | boolean;
export interface Token {
  kind: 'number' | 'string' | 'word' | 'symbol' | 'eof';
  text: string;
  line: number;
}
export type Expression =
  | { kind: 'literal'; value: Value; line: number }
  | { kind: 'variable'; name: string; line: number }
  | { kind: 'call'; name: string; args: Expression[]; line: number }
  | { kind: 'unary'; operator: string; operand: Expression; line: number }
  | { kind: 'binary'; operator: string; left: Expression; right: Expression; line: number };
export type Statement =
  | { kind: 'expression'; expression: Expression; line: number }
  | { kind: 'assign'; name: string; value: Expression; declare: boolean; line: number }
  | { kind: 'repeat'; count: Expression; body: Statement[]; line: number }
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
  ) {
    super(`Riga ${line}: ${message}`);
  }
}
