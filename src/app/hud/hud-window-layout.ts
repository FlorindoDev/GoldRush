import { signal } from '@angular/core';

type WindowName = string;
type ResizeTarget = WindowName | 'docked-console';
type WindowPosition = { x: number; y: number };
type WindowDrag = {
  name: WindowName;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  offsetX: number;
  offsetY: number;
  element: HTMLElement;
};
type WindowResize = {
  target: ResizeTarget;
  pointerId: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  originX: number;
  originY: number;
  element: HTMLElement;
};

/** Gestisce geometria e gesti delle finestre senza dipendere dal gioco. */
export class HudWindowLayout {
  readonly consoleDocked = signal(false);
  readonly activeWindow = signal<WindowName>('editor');
  readonly editorPosition = signal<WindowPosition | null>(null);
  readonly extraEditorPositions = signal<Record<string, WindowPosition>>({});
  readonly consolePosition = signal<WindowPosition | null>(null);
  private windowDrag?: WindowDrag;
  private windowResize?: WindowResize;

  toggleConsoleDock(): void {
    this.consoleDocked.update((docked) => !docked);
  }

  editorPositionFor(name: string): WindowPosition | null {
    return name === 'editor' ? this.editorPosition() : (this.extraEditorPositions()[name] ?? null);
  }

  placeEditor(name: string, index: number): void {
    const column = index % 3;
    this.setWindowPosition(name, {
      x: Math.max(8, window.innerWidth - 24 - (column + 1) * 430),
      y: Math.max(8, Math.min(window.innerHeight - 320, 78 + Math.floor(index / 3) * 42)),
    });
    this.activeWindow.set(name);
  }

  placeEditorAt(name: string, clientX: number, clientY: number): void {
    const mobile = window.innerWidth <= 600;
    const width = mobile ? window.innerWidth - 24 : Math.min(410, window.innerWidth - 32);
    const height = mobile
      ? Math.max(
          Math.min(260, window.innerHeight - 80),
          Math.min(430, window.innerHeight - (window.innerWidth <= 440 ? 290 : 210)),
        )
      : Math.max(Math.min(310, window.innerHeight - 96), Math.min(650, window.innerHeight - 96));
    this.setWindowPosition(name, {
      x: Math.max(8, Math.min(clientX - 80, window.innerWidth - Math.max(1, width) - 8)),
      y: Math.max(8, Math.min(clientY - 24, window.innerHeight - Math.max(1, height) - 8)),
    });
    this.activeWindow.set(name);
  }

  focusWindow(name: string): void {
    this.activeWindow.set(name);
  }

  forgetEditor(name: string): void {
    if (name === 'editor') {
      this.editorPosition.set(null);
      if (this.activeWindow() === name) this.activeWindow.set('console');
      return;
    }
    this.extraEditorPositions.update((positions) => {
      const remaining = { ...positions };
      delete remaining[name];
      return remaining;
    });
    if (this.activeWindow() === name) this.activeWindow.set('editor');
  }

  startWindowDrag(event: PointerEvent, name: WindowName): void {
    this.activeWindow.set(name);
    const target = event.target as HTMLElement;
    const heading = target.closest<HTMLElement>('.panel-heading');
    if (!heading || target.closest('button, a, input, select') || event.button !== 0) {
      return;
    }

    const element = event.currentTarget as HTMLElement;
    const bounds = element.getBoundingClientRect();
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    this.setWindowPosition(name, { x: bounds.left, y: bounds.top });
    this.windowDrag = {
      name,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      element,
    };
    heading.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  startWindowResize(event: PointerEvent, target: ResizeTarget): void {
    event.stopPropagation();
    if (event.button !== 0) {
      return;
    }

    const handle = event.currentTarget as HTMLElement;
    const element = handle.parentElement;
    if (!element) {
      return;
    }

    const bounds = element.getBoundingClientRect();
    this.focusResizeTarget(target, element);
    this.anchorResizableWindow(target, element, bounds);
    this.windowResize = {
      target,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: bounds.width,
      startHeight: bounds.height,
      originX: bounds.left,
      originY: bounds.top,
      element,
    };
    handle.setPointerCapture(event.pointerId);
  }

  resizeWindowWithKeyboard(event: KeyboardEvent, target: ResizeTarget): void {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      return;
    }

    const horizontal = target !== 'docked-console';
    if (!horizontal && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      return;
    }

    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    const element = handle.parentElement;
    if (!element) {
      return;
    }

    const bounds = element.getBoundingClientRect();
    this.focusResizeTarget(target, element);
    this.anchorResizableWindow(target, element, bounds);
    const step = event.shiftKey ? 48 : 16;
    const width =
      bounds.width + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0);
    const height =
      bounds.height + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0);
    this.applyWindowSize(target, element, width, height, bounds.left, bounds.top);
  }

  moveWindow(event: PointerEvent): void {
    const drag = this.windowDrag;
    if (drag && event.pointerId === drag.pointerId) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 12) {
        drag.moved = true;
      }
      const maxX = Math.max(8, window.innerWidth - drag.element.offsetWidth - 8);
      const maxY = Math.max(8, window.innerHeight - drag.element.offsetHeight - 8);
      this.setWindowPosition(drag.name, {
        x: Math.min(maxX, Math.max(8, event.clientX - drag.offsetX)),
        y: Math.min(maxY, Math.max(8, event.clientY - drag.offsetY)),
      });
      return;
    }

    const resize = this.windowResize;
    if (!resize || event.pointerId !== resize.pointerId) {
      return;
    }

    this.applyWindowSize(
      resize.target,
      resize.element,
      resize.startWidth + event.clientX - resize.startX,
      resize.startHeight + event.clientY - resize.startY,
      resize.originX,
      resize.originY,
    );
  }

  stopWindowInteraction(event: PointerEvent): { name: WindowName; moved: boolean } | null {
    let finishedDrag: { name: WindowName; moved: boolean } | null = null;
    if (this.windowDrag?.pointerId === event.pointerId) {
      finishedDrag = { name: this.windowDrag.name, moved: this.windowDrag.moved };
      this.windowDrag = undefined;
    }
    if (this.windowResize?.pointerId === event.pointerId) {
      this.windowResize = undefined;
    }
    return finishedDrag;
  }

  private focusResizeTarget(target: ResizeTarget, element: HTMLElement): void {
    this.activeWindow.set(
      target === 'docked-console'
        ? (element.closest<HTMLElement>('.editor-window')?.dataset['editorWindowId'] ?? 'editor')
        : target,
    );
  }

  private anchorResizableWindow(target: ResizeTarget, element: HTMLElement, bounds: DOMRect): void {
    if (target === 'docked-console') {
      return;
    }
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    this.setWindowPosition(target, { x: bounds.left, y: bounds.top });
  }

  private applyWindowSize(
    target: ResizeTarget,
    element: HTMLElement,
    width: number,
    height: number,
    originX: number,
    originY: number,
  ): void {
    if (target === 'docked-console') {
      const maxHeight = window.innerHeight * 0.55;
      const minHeight = Math.min(112, maxHeight);
      element.style.height = `${this.clamp(height, minHeight, maxHeight)}px`;
      return;
    }

    const maxWidth = Math.max(1, window.innerWidth - originX - 8);
    const maxHeight = Math.max(1, window.innerHeight - originY - 8);
    const minWidth = Math.min(target === 'console' ? 260 : 320, maxWidth);
    const minHeight = Math.min(target === 'console' ? 120 : 310, maxHeight);
    element.style.width = `${this.clamp(width, minWidth, maxWidth)}px`;
    element.style.height = `${this.clamp(height, minHeight, maxHeight)}px`;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }

  private setWindowPosition(name: WindowName, position: WindowPosition): void {
    if (name === 'editor') {
      this.editorPosition.set(position);
      return;
    }
    if (name === 'console') {
      this.consolePosition.set(position);
      return;
    }
    this.extraEditorPositions.update((positions) => ({ ...positions, [name]: position }));
  }
}
