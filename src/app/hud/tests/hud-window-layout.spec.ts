import { afterEach, describe, expect, it, vi } from 'vitest';
import { HudWindowLayout } from '../hud-window-layout';

afterEach(() => vi.unstubAllGlobals());

describe('HudWindowLayout', () => {
  it('toggles dock state without touching the game', () => {
    const layout = new HudWindowLayout();
    expect(layout.consoleDocked()).toBe(false);
    layout.toggleConsoleDock();
    expect(layout.consoleDocked()).toBe(true);
    layout.toggleConsoleDock();
    expect(layout.consoleDocked()).toBe(false);
  });

  it('resizes the docked console vertically using the keyboard', () => {
    vi.stubGlobal('window', { innerWidth: 1200, innerHeight: 800 });
    const layout = new HudWindowLayout();
    const element = {
      style: { height: '' },
      getBoundingClientRect: () => ({ width: 300, height: 180, left: 0, top: 0 }),
      closest: () => null,
    };
    const preventDefault = vi.fn();
    layout.resizeWindowWithKeyboard(
      {
        key: 'ArrowDown',
        shiftKey: false,
        currentTarget: { parentElement: element },
        preventDefault,
      } as unknown as KeyboardEvent,
      'docked-console',
    );
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(element.style.height).toBe('196px');
    expect(layout.activeWindow()).toBe('editor');
  });
});
