import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { CalculationResult } from '../../../../services/calculation-result.service';
import {
  buildPolygonHeatmapPayload,
  LuxScaleService,
  PolygonHeatmap,
} from '../../../../services/luxscale.service';
import { HeatmapPreviewComponent } from '../../../../shared/room-plan/heatmap-preview.component';
import {
  DEFAULT_HEATMAP_RESOLUTION,
  HEATMAP_RESOLUTIONS,
  clampHeatmapResolution,
} from '../../../../shared/room-plan/heatmap-render';
import { RoomPlanPreviewComponent } from '../../../../shared/room-plan/room-plan-preview.component';
import { Point } from '../../../../shared/room-plan/room-polygon';

export type CalculationType = 'Polygon' | 'Rectangular';
export type PreviewTab = 'layout' | 'heatmap';

@Component({
  selector: 'app-result-preview',
  imports: [RoomPlanPreviewComponent, HeatmapPreviewComponent],
  templateUrl: './result-preview.component.html',
  styleUrl: './result-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultPreviewComponent {
  private readonly luxscaleService = inject(LuxScaleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heatmapCache = new Map<string, PolygonHeatmap>();
  private readonly panelId = Math.random().toString(36).slice(2, 10);
  private heatmapSub: Subscription | null = null;

  readonly calculationType = input<CalculationType>('Rectangular');
  readonly selectedIndex = input(0);
  readonly result = input<CalculationResult | null>(null);
  readonly height = input<number | null>(null);

  readonly width1 = input<number | null>(null);
  readonly length1 = input<number | null>(null);
  readonly width2 = input<number | null>(null);
  readonly length2 = input<number | null>(null);
  readonly engineLength = input<number | null>(null);
  readonly engineWidth = input<number | null>(null);
  readonly vertices = input<readonly Point[] | null>(null);
  readonly holes = input<readonly Point[][] | null>(null);
  readonly layoutNx = input<number | null>(null);
  readonly layoutNy = input<number | null>(null);
  readonly usedSpacingX = input<number | null>(null);
  readonly usedSpacingY = input<number | null>(null);
  readonly fixtureCoordinates = input<unknown>(null);
  readonly offsetStartX = input<number | null>(null);
  readonly offsetStartY = input<number | null>(null);
  readonly offsetEndMinX = input<number | null>(null);
  readonly offsetEndMinY = input<number | null>(null);
  readonly layoutMode = input<'auto' | 'user_grid' | null>(null);

  protected readonly previewTab = signal<PreviewTab>('layout');
  protected readonly heatmap = signal<PolygonHeatmap | null>(null);
  protected readonly heatmapLoading = signal(false);
  protected readonly heatmapError = signal<string | null>(null);
  protected readonly resolution = signal(DEFAULT_HEATMAP_RESOLUTION);
  protected readonly resolutionOptions = HEATMAP_RESOLUTIONS;

  protected readonly isPolygon = computed(() => this.calculationType() === 'Polygon');
  protected readonly layoutPanelId = `result-preview-layout-${this.panelId}`;
  protected readonly heatmapPanelId = `result-preview-heatmap-${this.panelId}`;

  constructor() {
    this.destroyRef.onDestroy(() => this.heatmapSub?.unsubscribe());
    effect(() => {
      this.selectedIndex();
      untracked(() => this.previewTab.set('layout'));
    });
  }

  setPreviewTab(tab: PreviewTab): void {
    this.previewTab.set(tab);
    if (tab === 'heatmap') {
      this.ensureHeatmap();
    }
  }

  onResolutionChange(event: Event): void {
    const value = clampHeatmapResolution((event.target as HTMLSelectElement).value);
    this.resolution.set(value);
    if (this.previewTab() === 'heatmap') {
      this.ensureHeatmap();
    }
  }

  private cacheKey(index: number): string {
    return `${index}:${this.resolution()}`;
  }

  private ensureHeatmap(): void {
    if (this.calculationType() !== 'Polygon') {
      return;
    }
    const index = this.selectedIndex();
    const cached = this.heatmapCache.get(this.cacheKey(index));
    if (cached) {
      this.heatmap.set(cached);
      this.heatmapError.set(null);
      this.heatmapLoading.set(false);
      return;
    }

    const result = this.result();
    const vertices = this.vertices();
    const payload =
      result && vertices
        ? buildPolygonHeatmapPayload(vertices, this.height(), result, {
            resolution: this.resolution(),
          })
        : null;
    if (!payload) {
      this.heatmap.set(null);
      this.heatmapLoading.set(false);
      this.heatmapError.set('Heatmap is not available for this solution.');
      return;
    }

    this.heatmapLoading.set(true);
    this.heatmapError.set(null);
    this.heatmap.set(null);
    this.heatmapSub?.unsubscribe();
    this.heatmapSub = this.luxscaleService.polygonHeatmap(payload).subscribe({
      next: (response) => {
        this.heatmapCache.set(this.cacheKey(index), response.heatmap);
        this.heatmap.set(response.heatmap);
        this.heatmapLoading.set(false);
      },
      error: (err: unknown) => {
        this.heatmap.set(null);
        this.heatmapLoading.set(false);
        this.heatmapError.set(messageFromError(err));
      },
    });
  }
}

function messageFromError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { message?: string } | string | null;
    if (body && typeof body === 'object' && body.message) {
      return body.message;
    }
    if (typeof body === 'string' && body.trim() && !body.trim().startsWith('<')) {
      return body;
    }
  }
  return 'Heatmap failed. Try again.';
}
