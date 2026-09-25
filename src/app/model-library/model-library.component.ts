import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import {
  MODEL_CATEGORIES,
  type ModelAsset,
  type ModelCatalog,
  type ModelCategory,
} from '../assets/models/model-catalog';
import { ModelPreview } from './model-preview';

@Component({
  selector: 'app-model-library',
  templateUrl: './model-library.component.html',
  styleUrl: './model-library.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelLibraryComponent implements AfterViewInit, OnDestroy {
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly categories = MODEL_CATEGORIES;
  readonly catalog = signal<ModelCatalog | null>(null);
  readonly category = signal<ModelCategory | 'all'>('all');
  readonly query = signal('');
  readonly selected = signal<ModelAsset | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly spinning = signal(true);
  readonly fanTierCount = computed(
    () => this.catalog()?.models.filter((model) => model.category === 'fans').length ?? 0,
  );
  readonly visibleModels = computed(() => {
    const query = this.query().toLocaleLowerCase('it');
    return (this.catalog()?.models ?? []).filter(
      (model) =>
        (this.category() === 'all' || model.category === this.category()) &&
        `${model.name} ${model.id}`.toLocaleLowerCase('it').includes(query),
    );
  });
  readonly selectedCategory = computed(
    () =>
      this.categories.find((category) => category.id === this.selected()?.category)?.label ?? '',
  );
  private preview?: ModelPreview;
  private readonly abort = new AbortController();
  private selectionRequest = 0;

  async ngAfterViewInit(): Promise<void> {
    try {
      const response = await fetch('assets/models/catalog.json', { signal: this.abort.signal });
      if (!response.ok) {
        throw new Error('Catalogo non disponibile.');
      }
      const catalog: ModelCatalog = await response.json();
      if (this.abort.signal.aborted) {
        return;
      }
      this.catalog.set(catalog);
      const requested = new URLSearchParams(location.search).get('model');
      const first = catalog.models.find((model) => model.id === requested) ?? catalog.models[0];
      try {
        this.preview = new ModelPreview(this.canvas().nativeElement);
      } catch {
        this.error.set('Anteprima 3D non disponibile. Puoi comunque scaricare i modelli.');
      }
      if (first) {
        await this.select(first);
      } else {
        this.loading.set(false);
      }
    } catch {
      if (!this.abort.signal.aborted) {
        this.error.set('Impossibile caricare il catalogo. Ricarica la pagina per riprovare.');
        this.loading.set(false);
      }
    }
  }

  async select(asset: ModelAsset): Promise<void> {
    const request = ++this.selectionRequest;
    this.selected.set(asset);
    const url = new URL(location.href);
    url.searchParams.set('model', asset.id);
    history.replaceState(null, '', url);
    if (!this.preview) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.preview.show(asset);
    } catch {
      if (request === this.selectionRequest && !this.abort.signal.aborted) {
        this.error.set('Modello non disponibile. Seleziona un altro elemento o riprova.');
      }
    } finally {
      if (request === this.selectionRequest && !this.abort.signal.aborted) {
        this.loading.set(false);
      }
    }
  }

  toggleFans(): void {
    this.spinning.update((value) => !value);
    if (this.preview) {
      this.preview.animateFans = this.spinning();
    }
  }

  resetCamera(): void {
    this.preview?.resetCamera();
  }

  ngOnDestroy(): void {
    this.abort.abort();
    this.selectionRequest++;
    this.preview?.dispose();
  }
}
