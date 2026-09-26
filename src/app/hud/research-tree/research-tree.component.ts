import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  RESEARCH_TREE,
  flattenResearchTree,
  type ResearchNode,
  type ResearchRequirement,
} from '../../config/research-tree-config';
import { GameService } from '../../game/game.service';
import { countUnlockedRigs } from '../../game/mining-world';
import {
  canUnlockResearch,
  requirementMet,
  researchNode,
  researchPriceAvailable,
  researchRequirements,
} from '../../game/research';
import { IconComponent } from '../icons/icon.component';
import type { ResearchThumbnails } from './research-thumbnails';
import { layoutResearch } from './research-layout';
import { researchStats } from './research-details';

const euros = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

@Component({
  selector: 'app-research-tree',
  imports: [IconComponent],
  templateUrl: './research-tree.component.html',
  styleUrl: './research-tree.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResearchTreeComponent implements OnDestroy {
  readonly game = inject(GameService);
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly treeScroll = viewChild.required<ElementRef<HTMLElement>>('treeScroll');
  readonly tree = RESEARCH_TREE;
  readonly categories = RESEARCH_TREE.children ?? [];
  readonly category = signal<ResearchNode>(this.categories[0] ?? RESEARCH_TREE);
  readonly layout = computed(() => layoutResearch(this.category()));
  readonly minZoom = 0.1;
  readonly maxZoom = 2.5;
  readonly scale = signal(1);
  readonly offset = signal({ x: 0, y: 0 });
  readonly dragging = signal(false);
  readonly transform = computed(
    () => `translate(${this.offset().x}px, ${this.offset().y}px) scale(${this.scale()})`,
  );
  readonly zoomLabel = computed(() => `${Math.round(this.scale() * 100)}%`);
  readonly selected = signal<ResearchNode | null>(null);
  readonly thumbnails = signal<Record<string, string>>({});
  readonly feedback = signal('');
  readonly requirements = computed(() =>
    this.selected()
      ? researchRequirements(this.selected()!).filter(
          (requirement) =>
            requirement.kind !== 'node' ||
            ![this.tree.id, ...this.categories.map((branch) => branch.id)].includes(requirement.id),
        )
      : [],
  );
  readonly stats = computed(() => (this.selected() ? researchStats(this.selected()!) : []));
  readonly categoryNames = {
    root: 'Ricerca',
    gpu: 'Schede video',
    fan: 'Ventole',
    rig: 'Telai',
    filter: 'Filtri',
    crypto: 'Criptovalute',
  };
  readonly branchLabels: Record<string, string> = {
    gpu: 'GPU',
    fan: 'Ventole',
    rig: 'RIG',
    filter: 'Filtri',
    crypto: 'Cripto',
  };
  readonly selectionStatus = computed(() => {
    const node = this.selected();
    if (!node) return '';
    if (this.game.isResearchUnlocked(node.id)) return 'Sbloccato';
    if (!this.requirements().every((requirement) => this.requirementMet(requirement)))
      return 'Requisiti mancanti';
    return this.canUnlock() ? 'Disponibile' : 'Fondi insufficienti';
  });
  readonly unlockedCount = computed(
    () => flattenResearchTree().filter((node) => this.game.isResearchUnlocked(node.id)).length,
  );
  readonly totalCount = flattenResearchTree().length;
  readonly canUnlock = computed(() =>
    this.selected() ? canUnlockResearch(this.game.world(), this.selected()!) : false,
  );
  readonly balance = computed(() => researchPriceAvailable(this.game.world()));
  readonly formatEuros = (amount: number) => euros.format(amount);
  private preview?: ResearchThumbnails;
  private loading = false;
  private readonly failedPaths = new Set<string>();
  private opened = false;
  private session = 0;
  private resizeObserver?: ResizeObserver;
  private pointer?: { id: number; x: number; y: number; originX: number; originY: number };
  private suppressClick = false;
  private destroyed = false;

  constructor() {
    afterNextRender(() => {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.opened) this.fit();
      });
      this.resizeObserver.observe(this.treeScroll().nativeElement);
    });
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.failedPaths.clear();
    this.dialog().nativeElement.showModal();
    this.selected.set(
      this.selected() ?? RESEARCH_TREE.children?.[0]?.children?.[0] ?? RESEARCH_TREE,
    );
    requestAnimationFrame(() => {
      if (this.opened) this.fit();
    });
    void this.loadThumbnails();
  }

  close(): void {
    this.stopPreviews();
    this.dialog().nativeElement.close();
  }

  stopPreviews(): void {
    if (!this.opened) return;
    this.opened = false;
    this.session++;
    this.pointer = undefined;
    this.dragging.set(false);
    this.preview?.dispose();
    this.preview = undefined;
  }

  onDialogClose(): void {
    if (!this.dialog().nativeElement.open) this.stopPreviews();
  }

  showCategory(category: ResearchNode): void {
    this.category.set(category);
    this.select(category.children?.[0] ?? category);
    this.fit();
  }

  available(node: ResearchNode): boolean {
    return canUnlockResearch(this.game.world(), node);
  }

  goToRequirement(id: string): void {
    const node = researchNode(id);
    if (!node) return;
    this.category.set(
      this.categories.find((branch) => branch.category === node.category) ?? this.tree,
    );
    this.select(node);
    this.fit();
  }

  fit(): void {
    const viewport = this.treeScroll().nativeElement;
    const layout = this.layout();
    const scale = Math.max(
      this.minZoom,
      Math.min(
        1,
        (viewport.clientWidth - 48) / layout.width,
        (viewport.clientHeight - 48) / layout.height,
      ),
    );
    this.scale.set(scale);
    this.offset.set({
      x: (viewport.clientWidth - layout.width * scale) / 2,
      y: (viewport.clientHeight - layout.height * scale) / 2,
    });
  }

  zoom(factor: number, x?: number, y?: number): void {
    const viewport = this.treeScroll().nativeElement;
    const anchorX = x ?? viewport.clientWidth / 2;
    const anchorY = y ?? viewport.clientHeight / 2;
    const previous = this.scale();
    const next = Math.max(this.minZoom, Math.min(this.maxZoom, previous * factor));
    this.offset.update((offset) => ({
      x: anchorX - ((anchorX - offset.x) * next) / previous,
      y: anchorY - ((anchorY - offset.y) * next) / previous,
    }));
    this.scale.set(next);
  }

  wheel(event: WheelEvent): void {
    event.preventDefault();
    const bounds = this.treeScroll().nativeElement.getBoundingClientRect();
    const delta =
      event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1);
    this.zoom(
      Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.002),
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    );
  }

  pointerDown(event: PointerEvent): void {
    if (!event.isPrimary || (event.button !== 0 && event.button !== 1)) return;
    if (event.button === 1) event.preventDefault();
    this.suppressClick = false;
    this.pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: this.offset().x,
      originY: this.offset().y,
    };
  }

  pointerMove(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!this.dragging() && Math.hypot(dx, dy) < 5) return;
    this.treeScroll().nativeElement.setPointerCapture(event.pointerId);
    this.dragging.set(true);
    this.suppressClick = true;
    this.offset.set({ x: pointer.originX + dx, y: pointer.originY + dy });
  }

  pointerUp(event: PointerEvent): void {
    if (this.pointer?.id !== event.pointerId) return;
    const viewport = this.treeScroll().nativeElement;
    if (viewport.hasPointerCapture(event.pointerId))
      viewport.releasePointerCapture(event.pointerId);
    this.pointer = undefined;
    this.dragging.set(false);
  }

  nodeClick(event: MouseEvent, node: ResearchNode): void {
    if (this.suppressClick && event.detail !== 0) return;
    this.select(node);
  }

  navigate(event: KeyboardEvent): void {
    if (event.target !== this.treeScroll().nativeElement) return;
    const movement: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: 60, y: 0 },
      ArrowRight: { x: -60, y: 0 },
      ArrowUp: { x: 0, y: 60 },
      ArrowDown: { x: 0, y: -60 },
    };
    if (movement[event.key]) {
      event.preventDefault();
      this.offset.update((offset) => ({
        x: offset.x + movement[event.key].x,
        y: offset.y + movement[event.key].y,
      }));
    } else if (['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault();
      if (event.key === '0') this.fit();
      else this.zoom(event.key === '-' ? 1 / 1.2 : 1.2);
    }
  }

  backdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  select(node: ResearchNode): void {
    this.selected.set(node);
    this.feedback.set('');
    void this.loadThumbnails();
  }

  unlock(): void {
    const node = this.selected();
    if (!node) return;
    try {
      this.game.unlockResearch(node.id);
      this.feedback.set(`${node.name} sbloccato.`);
    } catch (error) {
      this.feedback.set(error instanceof Error ? error.message : 'Sblocco non disponibile.');
    }
  }

  requirementLabel(requirement: ResearchRequirement): string {
    switch (requirement.kind) {
      case 'node':
        return researchNode(requirement.id)?.name ?? requirement.id;
      case 'blocks':
        return 'Blocchi estratti';
      case 'rigs':
        return 'RIG posseduti';
    }
  }

  requirementProgress(requirement: ResearchRequirement): string {
    if (requirement.kind === 'node')
      return this.requirementMet(requirement) ? 'Sbloccato' : 'Da sbloccare';
    const world = this.game.world();
    const count =
      requirement.kind === 'rigs'
        ? countUnlockedRigs(world)
        : Object.values(world.cryptoChains).reduce(
            (total, chain) => total + chain.settledBlockIds.length,
            0,
          );
    return `${Math.min(count, requirement.count)} / ${requirement.count}`;
  }

  requirementMet(requirement: ResearchRequirement): boolean {
    return requirementMet(this.game.world(), requirement);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopPreviews();
    this.resizeObserver?.disconnect();
  }

  private async loadThumbnails(): Promise<void> {
    if (this.loading || this.destroyed || !this.opened) return;
    this.loading = true;
    const session = this.session;
    let preview: ResearchThumbnails | undefined;
    try {
      const { ResearchThumbnails } = await import('./research-thumbnails');
      if (!this.opened || this.destroyed || session !== this.session) return;
      while (this.opened && !this.destroyed && session === this.session) {
        const paths = [
          this.selected()?.model,
          ...this.layout().nodes.map(({ node }) => node.model),
          ...this.categories.map((branch) => branch.model),
        ];
        const path = paths.find(
          (path) => path && !this.thumbnails()[path] && !this.failedPaths.has(path),
        );
        if (!path) break;
        preview ??= new ResearchThumbnails();
        this.preview = preview;
        try {
          const image = await preview.render(path);
          if (image && this.opened && session === this.session) {
            this.thumbnails.update((old) => ({ ...old, [path]: image }));
          }
        } catch {
          this.failedPaths.add(path);
        }
      }
    } catch {
      // Anche senza WebGL l'albero e lo sblocco restano utilizzabili.
    } finally {
      preview?.dispose();
      if (this.preview === preview) this.preview = undefined;
      this.loading = false;
      if (this.opened && session !== this.session) void this.loadThumbnails();
    }
  }
}
