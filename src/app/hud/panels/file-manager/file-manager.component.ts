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

@Component({
  selector: 'app-file-manager',
  imports: [IconComponent],
  templateUrl: './file-manager.component.html',
  styleUrl: './file-manager.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileManagerComponent {
  readonly game = inject(GameService);
  readonly fileOpened = output<string>();
  readonly fileCreated = output<string>();
  readonly fileDeleted = output<string>();
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly opened = signal(false);
  readonly newName = signal('');
  readonly search = signal('');
  readonly filteredFiles = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.game.files().filter((file) => file.name.toLocaleLowerCase().includes(query));
  });
  readonly renamingId = signal<string | null>(null);
  readonly renameValue = signal('');
  readonly deletingId = signal<string | null>(null);
  readonly feedback = signal('');

  open(): void {
    this.dialog().nativeElement.showModal();
    this.opened.set(true);
  }

  close(): void {
    this.dialog().nativeElement.close();
    this.opened.set(false);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  create(): void {
    try {
      const file = this.game.createFile(this.newName());
      this.newName.set('');
      this.feedback.set('');
      this.fileCreated.emit(file.id);
      this.close();
    } catch (error) {
      this.showError(error);
    }
  }

  openFile(id: string): void {
    this.fileOpened.emit(id);
    this.close();
  }

  startRename(id: string, name: string): void {
    this.renamingId.set(id);
    this.renameValue.set(name);
    this.deletingId.set(null);
    this.feedback.set('');
  }

  rename(id: string): void {
    try {
      this.game.renameFile(id, this.renameValue());
      this.renamingId.set(null);
      this.feedback.set('');
    } catch (error) {
      this.showError(error);
    }
  }

  deleteFile(id: string): void {
    try {
      this.game.deleteFile(id);
      this.deletingId.set(null);
      this.feedback.set('');
      this.fileDeleted.emit(id);
    } catch (error) {
      this.showError(error);
    }
  }

  private showError(error: unknown): void {
    this.feedback.set(error instanceof Error ? error.message : 'Operazione non riuscita.');
  }
}
