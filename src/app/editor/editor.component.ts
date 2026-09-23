import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { GameService } from '../game/game.service';
import { IconComponent } from '../shared/icon.component';
import { highlight } from './highlight';

const INDENTATION = '  ';

@Component({
  selector: 'app-editor',
  imports: [IconComponent],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent {
  readonly game = inject(GameService);
  readonly openGuide = output<void>();
  readonly gutterWidth = computed(() => {
    const lineCount = this.game.code().split('\n').length;
    return Math.max(44, String(lineCount).length * 8 + 16);
  });
  readonly highlighted = computed(() =>
    highlight(this.game.code(), {
      executedLines: this.game.executedLineEffects(),
      effectsEnabled: this.game.lineEffectsEnabled(),
      activeLine: this.game.activeLine(),
      errorLine: this.game.errorLine(),
      cursorLine: this.cursor().line,
    }),
  );
  readonly editor = viewChild.required<ElementRef<HTMLTextAreaElement>>('editor');
  readonly overlay = viewChild.required<ElementRef<HTMLElement>>('overlay');
  readonly cursor = signal({ line: 1, column: 1 });
  private captureTab = true;

  onInput(event: Event): void {
    this.game.updateCode((event.target as HTMLTextAreaElement).value);
    this.updateCursor();
  }

  updateCursor(): void {
    const textarea = this.editor().nativeElement;
    const linesBeforeCursor = textarea.value.slice(0, textarea.selectionStart).split('\n');
    const currentLine = linesBeforeCursor[linesBeforeCursor.length - 1];
    this.cursor.set({ line: linesBeforeCursor.length, column: currentLine.length + 1 });
  }

  syncScroll(): void {
    const editor = this.editor().nativeElement;
    this.overlay().nativeElement.scrollTop = editor.scrollTop;
    this.overlay().nativeElement.scrollLeft = editor.scrollLeft;
  }

  keydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void this.game.run();
      return;
    }
    if (event.key === 'Escape') {
      this.captureTab = false;
      return;
    }
    if (event.key === 'Tab' && this.captureTab && !event.shiftKey) {
      event.preventDefault();
      this.insert(INDENTATION);
    }
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.insertIndentedNewline();
    }
  }

  focus(): void {
    this.captureTab = true;
  }

  insert(text: string): void {
    if (this.game.running()) {
      return;
    }
    const textarea = this.editor().nativeElement;
    const start = textarea.selectionStart;
    const value =
      textarea.value.slice(0, start) + text + textarea.value.slice(textarea.selectionEnd);
    this.game.updateCode(value);
    textarea.value = value;
    textarea.focus();
    textarea.setSelectionRange(start + text.length, start + text.length);
    this.updateCursor();
  }

  selectFile(id: string): void {
    this.game.selectFile(id);
    this.resetEditorView();
  }

  addFile(): void {
    this.game.addFile();
    this.resetEditorView();
  }

  closeFile(id: string): void {
    this.game.closeFile(id);
    this.resetEditorView();
  }

  private resetEditorView(): void {
    const textarea = this.editor().nativeElement;
    textarea.value = this.game.code();
    textarea.scrollTop = 0;
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    this.syncScroll();
    this.cursor.set({ line: 1, column: 1 });
  }

  private insertIndentedNewline(): void {
    const textarea = this.editor().nativeElement;
    const beforeCursor = textarea.value.slice(0, textarea.selectionStart);
    const currentLine = beforeCursor.split('\n').at(-1) ?? '';
    const indentation = currentLine.match(/^\s*/)?.[0] ?? '';
    const opensBlock = currentLine.trimEnd().endsWith('{');
    const extraIndentation = opensBlock ? INDENTATION : '';

    this.insert('\n' + indentation + extraIndentation);
  }
}
