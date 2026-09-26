import { EXAMPLES } from '../language/examples';

export interface ScriptFile {
  id: string;
  name: string;
  code: string;
}

const CODE_STORAGE_KEY = 'blockcraft-code';
const FILES_STORAGE_KEY = 'blockcraft-files';
const ACTIVE_FILE_STORAGE_KEY = 'blockcraft-active-file';
const LINE_EFFECTS_STORAGE_KEY = 'blockcraft-line-effects';
const GPU_HOVER_TOOLTIP_STORAGE_KEY = 'blockcraft-gpu-hover-tooltip';
const DEFAULT_CODE = EXAMPLES[0].code;

export function loadScriptFiles(): ScriptFile[] {
  try {
    const stored = localStorage.getItem(FILES_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const files = parsed.filter(isScriptFile);
        const ids = new Set(files.map((file) => file.id));
        if (files.length && ids.size === files.length) {
          return files;
        }
      }
    }
  } catch {
    // Fall through to the legacy single-file save.
  }

  return [{ id: 'main', name: 'main.mine', code: loadLegacyCode() }];
}

export function loadActiveFileId(files: readonly ScriptFile[]): string {
  const firstFileId = files[0].id;
  try {
    const storedId = localStorage.getItem(ACTIVE_FILE_STORAGE_KEY);
    return files.some((file) => file.id === storedId) ? storedId! : firstFileId;
  } catch {
    return firstFileId;
  }
}

export function loadLineEffectsEnabled(): boolean {
  try {
    return localStorage.getItem(LINE_EFFECTS_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function persistLineEffectsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LINE_EFFECTS_STORAGE_KEY, String(enabled));
  } catch {
    // The preference remains usable for this session without storage.
  }
}

export function loadGpuHoverTooltipEnabled(): boolean {
  try {
    return localStorage.getItem(GPU_HOVER_TOOLTIP_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function persistGpuHoverTooltipEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(GPU_HOVER_TOOLTIP_STORAGE_KEY, String(enabled));
  } catch {
    // The preference remains usable for this session without storage.
  }
}

export function persistScriptFiles(
  files: readonly ScriptFile[],
  activeFileId: string,
  currentCode: string,
): void {
  try {
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files));
    localStorage.setItem(ACTIVE_FILE_STORAGE_KEY, activeFileId);
    const mainFile = files.find((file) => file.id === 'main');
    localStorage.setItem(CODE_STORAGE_KEY, mainFile?.code ?? currentCode);
  } catch {
    // Editing remains available without storage.
  }
}

function loadLegacyCode(): string {
  try {
    return localStorage.getItem(CODE_STORAGE_KEY) ?? DEFAULT_CODE;
  } catch {
    return DEFAULT_CODE;
  }
}

function isScriptFile(value: unknown): value is ScriptFile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const file = value as Partial<ScriptFile>;
  return (
    typeof file.id === 'string' && typeof file.name === 'string' && typeof file.code === 'string'
  );
}
