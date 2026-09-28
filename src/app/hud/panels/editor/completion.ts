export interface CompletionItem {
  readonly label: string;
  readonly kind: 'attributo' | 'metodo' | 'variabile' | 'funzione' | 'parola chiave';
}

export interface Completion {
  readonly start: number;
  readonly items: readonly CompletionItem[];
}

type ScriptType =
  'plot' | 'rig' | 'gpu' | 'estimate' | 'electricity' | 'stack' | 'queue' | `vector:${string}`;

const memberNames: Record<string, { attributes: string; methods: string }> = {
  plot: { attributes: 'id rigs rigCount gpuCount gpuCapacity', methods: '' },
  rig: { attributes: 'id plotId unlocked gpus gpuCount gpuCapacity', methods: '' },
  gpu: {
    attributes:
      'id crypto progress rigId plotId unlocked working stopped stopReason selected model frequencyGhz powerWatts progressPerAction temperatureCelsius fanSpeed targetFanSpeedPercent currentFanSpeedRpm maxFrequencyGhz minFrequencyGhz absoluteMaxFrequencyGhz targetFrequencyGhz wearPercent dustPercent fanKit maxFanSpeedRpm maxTemperatureCelsius',
    methods:
      'estimate getModel getFrequencyGhz getTargetFrequencyGhz getMinFrequencyGhz getMaxFrequencyGhz getAbsoluteMaxFrequencyGhz getPowerWatts getTemperatureCelsius getFanSpeed getTargetFanSpeedPercent getCurrentFanSpeedRpm getMaxFanSpeedRpm getMaxTemperatureCelsius getWearPercent getDustPercent isWorking isSelected isStopped getStopReason setFrequencyGhz setFanSpeed setFanSpeedAuto stop clearStop',
  },
  estimate: {
    attributes:
      'crypto unlocked difficulty maxDifficulty rewardEur progressPerAction powerWatts energyCostPerActionEur revenuePerActionEur profitPerActionEur',
    methods: '',
  },
  electricity: {
    attributes: 'powerWatts energyKwh pendingCostEur totalCostEur pricePerKwh',
    methods: 'getPowerWatts getEnergyKwh getPendingCostEur getTotalCostEur getPricePerKwh',
  },
  vector: {
    attributes: 'length size first last',
    methods:
      'size length push pop set insert remove contains indexOf concat slice copy reverse sort clear isEmpty',
  },
  stack: { attributes: 'size length', methods: 'size length push pop peek isEmpty clear' },
  queue: {
    attributes: 'size length',
    methods: 'size length enqueue dequeue peek front back isEmpty clear',
  },
};

const globals = 'plots electricity print wait mine setCrypto progress vector stack queue'.split(
  ' ',
);
const keywords = 'let def return if else while for repeat parallel import from true false'.split(
  ' ',
);
const chainPattern =
  /([A-Za-z_]\w*(?:\s*(?:\[[^\]\n]*\]|\([^\)\n]*\)|\.[A-Za-z_]\w*))*)\.\s*([A-Za-z_]\w*)?$/;

export function getCompletions(
  source: string,
  cursor: number,
  explicit = false,
): Completion | null {
  const before = source.slice(0, cursor);
  const masked = maskNonCode(before);
  if (!masked.codeAtEnd) return null;

  const variables = inferVariables(masked.text);
  const member = chainPattern.exec(masked.text);
  if (member) {
    const type = resolveType(member[1], variables);
    if (!type) return null;
    const query = member[2] ?? '';
    const members = memberNames[type.startsWith('vector:') ? 'vector' : type];
    if (!members) return null;
    const items = [
      ...members.attributes
        .split(' ')
        .filter(Boolean)
        .map((label) => ({ label, kind: 'attributo' as const })),
      ...members.methods
        .split(' ')
        .filter(Boolean)
        .map((label) => ({ label, kind: 'metodo' as const })),
    ].filter((item) => item.label.toLowerCase().startsWith(query.toLowerCase()));
    return items.length ? { start: cursor - query.length, items } : null;
  }

  const word = /([A-Za-z_]\w*)?$/.exec(masked.text)?.[1] ?? '';
  if (!explicit && word.length < 2) return null;
  const start = cursor - word.length;
  if (masked.text[start - 1] === '.') return null;
  const names = [
    ...globals.map((label) => ({
      label,
      kind:
        label === 'plots' || label === 'electricity'
          ? ('variabile' as const)
          : ('funzione' as const),
    })),
    ...keywords.map((label) => ({ label, kind: 'parola chiave' as const })),
    ...[...variables.keys()].map((label) => ({ label, kind: 'variabile' as const })),
    ...[...masked.text.matchAll(/\bdef\s+([A-Za-z_]\w*)/g)].map((match) => ({
      label: match[1],
      kind: 'funzione' as const,
    })),
  ];
  const unique = new Map(names.map((item) => [item.label, item]));
  const items = [...unique.values()].filter((item) =>
    item.label.toLowerCase().startsWith(word.toLowerCase()),
  );
  if (!explicit && items.length === 1 && items[0].label === word) return null;
  return items.length ? { start, items } : null;
}

function inferVariables(source: string): Map<string, ScriptType> {
  const variables = new Map<string, ScriptType>();
  const assignment = /(?:^|[;{}\n])\s*(?:let\s+)?([A-Za-z_]\w*)\s*=\s*(?![=])([^;\n]*)/g;
  for (const match of source.matchAll(assignment)) {
    const type = resolveType(match[2].trim(), variables);
    if (type) variables.set(match[1], type);
    else variables.delete(match[1]);
  }
  return variables;
}

function resolveType(
  expression: string,
  variables: ReadonlyMap<string, ScriptType>,
): ScriptType | null {
  const root = /^[A-Za-z_]\w*/.exec(expression);
  if (!root) return null;
  let type: ScriptType | null =
    root[0] === 'plots'
      ? 'vector:plot'
      : root[0] === 'electricity'
        ? 'electricity'
        : (variables.get(root[0]) ?? null);
  let position = root[0].length;

  while (position < expression.length) {
    while (/\s/.test(expression[position] ?? '') && position < expression.length) position++;
    const char = expression[position];
    if (char === '[') {
      const end = findClosing(expression, position, '[', ']');
      if (end < 0 || !type?.startsWith('vector:')) return null;
      type = type.slice('vector:'.length) as ScriptType;
      position = end + 1;
    } else if (char === '.') {
      const member = /^[A-Za-z_]\w*/.exec(expression.slice(position + 1));
      if (!member || !type) return null;
      const name = member[0];
      position += name.length + 1;
      while (expression[position] === ' ') position++;
      const call = expression[position] === '(';
      type = memberType(type, name, call);
      if (call) {
        const end = findClosing(expression, position, '(', ')');
        if (end < 0) return null;
        position = end + 1;
      }
    } else if (char === '(' && position === root[0].length) {
      const end = findClosing(expression, position, '(', ')');
      if (end < 0) return null;
      type =
        root[0] === 'vector'
          ? 'vector:unknown'
          : root[0] === 'stack'
            ? 'stack'
            : root[0] === 'queue'
              ? 'queue'
              : null;
      position = end + 1;
    } else {
      return null;
    }
  }
  return type;
}

function memberType(type: ScriptType, name: string, call: boolean): ScriptType | null {
  if (type === 'plot' && !call && name === 'rigs') return 'vector:rig';
  if (type === 'rig' && !call && name === 'gpus') return 'vector:gpu';
  if (type === 'gpu' && call && name === 'estimate') return 'estimate';
  if (type.startsWith('vector:')) {
    if (!call && (name === 'first' || name === 'last')) return type.slice(7) as ScriptType;
    if (call && ['slice', 'copy', 'concat', 'reverse', 'sort'].includes(name)) return type;
    if (call && name === 'pop') return type.slice(7) as ScriptType;
  }
  return null;
}

function findClosing(source: string, start: number, opening: string, closing: string): number {
  let depth = 0;
  for (let index = start; index < source.length; index++) {
    if (source[index] === opening) depth++;
    if (source[index] === closing && --depth === 0) return index;
  }
  return -1;
}

function maskNonCode(source: string): { text: string; codeAtEnd: boolean } {
  let state: 'code' | 'line' | 'block' | 'string' = 'code';
  let quote = '';
  let escaped = false;
  const result: string[] = [];
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (state === 'code') {
      if (char === '/' && next === '/') state = 'line';
      else if (char === '/' && next === '*') state = 'block';
      else if (char === '"' || char === "'") {
        state = 'string';
        quote = char;
      }
    } else if (state === 'line' && char === '\n') state = 'code';
    else if (state === 'block' && char === '*' && next === '/') {
      result.push(' ');
      index++;
      state = 'code';
    } else if (state === 'string') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) state = 'code';
    }
    result.push(state === 'code' ? char : char === '\n' ? '\n' : ' ');
  }
  return { text: result.join(''), codeAtEnd: state === 'code' };
}
