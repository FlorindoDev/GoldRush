import { parse } from './parser';
import { ScriptError, type Statement } from './syntax';

export type FunctionDefinition = {
  statement: Extract<Statement, { kind: 'def' }>;
  sourceName?: string;
  functions: ReadonlyMap<string, FunctionDefinition>;
};

export interface ResolvedProgram {
  statements: Statement[];
  functions: ReadonlyMap<string, FunctionDefinition>;
}

/** Risolve gli import e i nomi visibili prima di eseguire la prima istruzione. */
export function resolveProgram(
  source: string,
  modules: Readonly<Record<string, string>> = {},
  entryName?: string,
  reservedNames: ReadonlySet<string> = new Set(),
): ResolvedProgram {
  const loaded = new Map<string, ReadonlyMap<string, FunctionDefinition>>();
  const loading = new Set<string>(entryName ? [entryName] : []);

  const read = (code: string, sourceName?: string, entry = false): ResolvedProgram => {
    let statements: Statement[];
    try {
      statements = parse(code);
    } catch (error) {
      if (error instanceof ScriptError) error.sourceName ??= sourceName;
      throw error;
    }

    if (!entry) {
      const invalid = statements.find(
        (statement) => statement.kind !== 'def' && statement.kind !== 'import',
      );
      if (invalid) {
        throw new ScriptError(
          'un file importato può contenere solo def e import.',
          invalid.line,
          sourceName,
        );
      }
    }

    const functions = new Map<string, FunctionDefinition>();
    for (const statement of statements) {
      if (statement.kind !== 'import') continue;
      const importedName = statement.fileName;
      if (loading.has(importedName)) {
        throw new ScriptError(`import circolare di "${importedName}".`, statement.line, sourceName);
      }
      let importedFunctions = loaded.get(importedName);
      if (!importedFunctions) {
        if (!Object.hasOwn(modules, importedName)) {
          throw new ScriptError(`file "${importedName}" non trovato.`, statement.line, sourceName);
        }
        loading.add(importedName);
        try {
          importedFunctions = read(modules[importedName], importedName).functions;
          loaded.set(importedName, importedFunctions);
        } finally {
          loading.delete(importedName);
        }
      }

      for (const name of statement.names ?? importedFunctions.keys()) {
        const definition = importedFunctions.get(name);
        if (!definition) {
          throw new ScriptError(
            `funzione "${name}" non trovata in "${importedName}".`,
            statement.line,
            sourceName,
          );
        }
        if (functions.has(name) && functions.get(name) !== definition) {
          throw new ScriptError(
            `funzione "${name}" già definita o riservata.`,
            statement.line,
            sourceName,
          );
        }
        functions.set(name, definition);
      }
    }

    for (const statement of statements) {
      if (statement.kind !== 'def') continue;
      if (reservedNames.has(statement.name) || functions.has(statement.name)) {
        throw new ScriptError(
          `funzione "${statement.name}" già definita o riservata.`,
          statement.line,
          sourceName,
        );
      }
      functions.set(statement.name, { statement, sourceName, functions });
    }

    return {
      statements: entry
        ? statements.filter((statement) => statement.kind !== 'def' && statement.kind !== 'import')
        : [],
      functions,
    };
  };

  return read(source, entryName, true);
}
