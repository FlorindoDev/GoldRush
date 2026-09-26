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
import { GameService } from '../../../game/game.service';
import { IconComponent } from '../../icons/icon.component';
import { highlight } from './highlight';
import { autoIndent } from './indentation';

const INDENTATION = '  ';

interface CursorPosition {
  line: number;
  column: number;
}

interface TextEdit {
  start: number;
  deleteLength: number;
  insertLength: number;
}

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
  readonly cursor = signal<CursorPosition>({ line: 1, column: 1 });
  private capturesTabKey = true;

  onInput(event: Event): void {
    this.game.updateCode((event.target as HTMLTextAreaElement).value);
    this.updateCursor();
  }

  updateCursor(): void {
    const textarea = this.editor().nativeElement;
    const textBeforeCursor = textarea.value.slice(0, textarea.selectionStart);
    const linesBeforeCursor = textBeforeCursor.split('\n');
    const currentLine = linesBeforeCursor.at(-1)!;
    this.cursor.set({
      line: linesBeforeCursor.length,
      column: currentLine.length + 1,
    });
  }

  syncScroll(): void {
    const editor = this.editor().nativeElement;
    this.overlay().nativeElement.scrollTop = editor.scrollTop;
    this.overlay().nativeElement.scrollLeft = editor.scrollLeft;
  }

  keydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && (event.key === '/' || event.code === 'Slash')) {
      event.preventDefault();
      this.toggleLineComments();
      return;
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      event.altKey &&
      (event.key.toLowerCase() === 'a' || event.code === 'KeyA')
    ) {
      event.preventDefault();
      this.toggleBlockComment();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void this.game.run();
      return;
    }
    if (event.key === 'Escape') {
      this.capturesTabKey = false;
      return;
    }
    if (event.key === 'Tab' && this.capturesTabKey && !event.shiftKey) {
      event.preventDefault();
      this.insert(INDENTATION);
    }
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.insertIndentedNewline();
    }
  }

  focus(): void {
    this.capturesTabKey = true;
  }

  insert(text: string): void {
    if (this.game.running()) {
      return;
    }
    const textarea = this.editor().nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const cursor = start + text.length;
    this.applyCodeEdit(start, end, text, cursor, cursor);
  }

  private toggleLineComments(): void {
    if (this.game.running()) {
      return;
    }

    const textarea = this.editor().nativeElement;
    const source = textarea.value;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const firstLineStart = source.lastIndexOf('\n', selectionStart - 1) + 1;
    const endProbe =
      selectionEnd > selectionStart && source[selectionEnd - 1] === '\n'
        ? selectionEnd - 2
        : selectionEnd - 1;
    const lastLineStart =
      selectionEnd === selectionStart ? firstLineStart : source.lastIndexOf('\n', endProbe) + 1;
    const lineEnd = source.indexOf('\n', lastLineStart);
    const replaceEnd = lineEnd < 0 ? source.length : lineEnd;
    const lines = source.slice(firstLineStart, replaceEnd).split('\n');
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    const shouldUncomment =
      nonEmptyLines.length > 0 && nonEmptyLines.every((line) => /^\s*\/\//.test(line));
    const edits: TextEdit[] = [];
    let originalOffset = firstLineStart;

    const updatedLines = lines.map((line, index) => {
      const originalLineLength = line.length;
      const indentation = line.match(/^[ \t]*/)?.[0] ?? '';
      const content = line.slice(indentation.length);
      if (shouldUncomment) {
        const marker = content.match(/^\/\/ ?/)?.[0];
        if (marker) {
          edits.push({
            start: originalOffset + indentation.length,
            deleteLength: marker.length,
            insertLength: 0,
          });
          line = indentation + content.slice(marker.length);
        }
      } else if (!/^\/\//.test(content)) {
        edits.push({
          start: originalOffset + indentation.length,
          deleteLength: 0,
          insertLength: 3,
        });
        line = `${indentation}// ${content}`;
      }
      originalOffset += originalLineLength + (index < lines.length - 1 ? 1 : 0);
      return line;
    });
    const replacement = updatedLines.join('\n');
    const nextSelectionStart = mapPosition(selectionStart, edits);
    const nextSelectionEnd = mapPosition(selectionEnd, edits);
    this.applyCodeEdit(
      firstLineStart,
      replaceEnd,
      replacement,
      nextSelectionStart,
      nextSelectionEnd,
    );
  }

  private toggleBlockComment(): void {
    if (this.game.running()) {
      return;
    }

    const textarea = this.editor().nativeElement;
    const source = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = source.slice(start, end);
    if (!selected) {
      this.applyCodeEdit(start, end, '/**/', start + 2, start + 2);
      return;
    }

    if (selected.startsWith('/*') && selected.endsWith('*/')) {
      const uncommented = selected.slice(2, -2);
      this.applyCodeEdit(start, end, uncommented, start, start + uncommented.length);
      return;
    }

    this.applyCodeEdit(start, end, `/*${selected}*/`, start, end + 4);
  }

  private applyCodeEdit(
    start: number,
    end: number,
    replacement: string,
    selectionStart: number,
    selectionEnd: number,
  ): void {
    const textarea = this.editor().nativeElement;
    const value = textarea.value.slice(0, start) + replacement + textarea.value.slice(end);
    this.game.updateCode(value);
    textarea.value = value;
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
    this.updateCursor();
  }

  formatIndentation(): void {
    if (this.game.running()) {
      return;
    }

    const textarea = this.editor().nativeElement;
    const source = textarea.value;
    const formatted = autoIndent(source, INDENTATION);
    if (formatted === source) {
      return;
    }

    const selectionStart = remapPosition(source, formatted, textarea.selectionStart);
    const selectionEnd = remapPosition(source, formatted, textarea.selectionEnd);
    this.game.updateCode(formatted);
    textarea.value = formatted;
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
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
    const continuesBlock = currentLine.trimEnd().endsWith('{');
    const extraIndentation = continuesBlock ? INDENTATION : '';

    this.insert(`\n${indentation}${extraIndentation}`);
  }
}

function mapPosition(position: number, edits: readonly TextEdit[]): number {
  let offset = 0;
  for (const edit of edits) {
    if (position < edit.start) {
      break;
    }
    const deleteEnd = edit.start + edit.deleteLength;
    if (position < deleteEnd) {
      return edit.start + offset + Math.min(position - edit.start, edit.insertLength);
    }
    offset += edit.insertLength - edit.deleteLength;
  }
  return position + offset;
}

function remapPosition(source: string, formatted: string, position: number): number {
  const sourceLineStart = source.lastIndexOf('\n', Math.max(0, position - 1)) + 1;
  const lineIndex = source.slice(0, sourceLineStart).split('\n').length - 1;
  const sourceLine = source.split('\n')[lineIndex] ?? '';
  const formattedLines = formatted.split('\n');
  const formattedLine = formattedLines[lineIndex] ?? '';
  const sourceIndentLength = sourceLine.match(/^[ \t]*/)?.[0].length ?? 0;
  const formattedIndentLength = formattedLine.match(/^[ \t]*/)?.[0].length ?? 0;
  const column = position - sourceLineStart;
  const mappedColumn =
    column < sourceIndentLength
      ? Math.min(column, formattedIndentLength)
      : formattedIndentLength + column - sourceIndentLength;
  const formattedLineStart = formattedLines
    .slice(0, lineIndex)
    .reduce((length, line) => length + line.length + 1, 0);

  return Math.min(formatted.length, formattedLineStart + mappedColumn);
}
