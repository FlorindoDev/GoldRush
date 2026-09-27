import { parse } from './parser';
import { ScriptError, type Statement } from './syntax';

export type FunctionDefinition = {
  statement: Extract<Statement, { kind: 'def' }>;
  sourceName?: string;
};

export interface ResolvedProgram {
  statements: Statement[];
  functions: ReadonlyMap<string, FunctionDefinition>;
}

/** Risolve tutti gli import prima di eseguire la prima istruzione. */
export function resolveProgram(
  source: string,
  modules: Readonly<Record<string, string>> = {},
  entryName?: string,
  reservedNames: ReadonlySet<string> = new Set(),
): ResolvedProgram {
  const functions = new Map<string, FunctionDefinition>();
  const loaded = new Set<string>();
  const loading = new Set<string>(entryName ? [entryName] : []);

  const read = (code: string, sourceName?: string, entry = false): Statement[] => {
    let statements: Statement[];
    try {
      statements = parse(code);
    } catch (error) {
      if (error instanceof ScriptError) error.sourceName ??= sourceName;
      throw error;
    }

    for (const statement of statements) {
      if (statement.kind !== 'import') continue;
      const importedName = statement.fileName;
      if (loading.has(importedName)) {
        throw new ScriptError(`import circolare di "${importedName}".`, statement.line, sourceName);
      }
      if (loaded.has(importedName)) continue;
      const importedSource = modules[importedName];
      if (importedSource === undefined) {
        throw new ScriptError(`file "${importedName}" non trovato.`, statement.line, sourceName);
      }
      loading.add(importedName);
      try {
        read(importedSource, importedName);
        loaded.add(importedName);
      } finally {
        loading.delete(importedName);
      }
    }

    for (const statement of statements) {
      if (statement.kind === 'def') {
        if (reservedNames.has(statement.name) || functions.has(statement.name)) {
          throw new ScriptError(
            `funzione "${statement.name}" già definita o riservata.`,
            statement.line,
            sourceName,
          );
        }
        functions.set(statement.name, { statement, sourceName });
      } else if (!entry && statement.kind !== 'import') {
        throw new ScriptError(
          'un file importato può contenere solo def e import.',
          statement.line,
          sourceName,
        );
      }
    }
    return entry
      ? statements.filter((statement) => statement.kind !== 'def' && statement.kind !== 'import')
      : [];
  };

  return { statements: read(source, entryName, true), functions };
}
