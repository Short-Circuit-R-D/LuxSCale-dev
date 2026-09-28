import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AdvancedStudyStore } from '../../stores/advanced-study.store';

@Component({
  selector: 'app-matrix-layers',
  template: `
    <div class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <!-- Layer Isolation -->
      <div>
        <span class="block font-mono text-[11px] text-muted tracking-widest uppercase mb-1.5">
          Lighting Layer (Matrix Isolation)
        </span>
        <div class="inline-flex w-full items-center p-0.5 rounded-lg border border-border/70 bg-[#0d0d0d]">
          <button
            type="button"
            class="flex-1 h-7 rounded-[5px] font-mono text-[11px] tracking-wider transition-all duration-150"
            [class]="store.activeLayer() === 'total' ? 'bg-primary text-white font-medium shadow-xs' : 'text-muted hover:text-white'"
            (click)="store.setActiveLayer('total')"
          >
            TOTAL
          </button>
          <button
            type="button"
            class="flex-1 h-7 rounded-[5px] font-mono text-[11px] tracking-wider transition-all duration-150"
            [class]="store.activeLayer() === 'direct' && !store.activeFixtureFilter() ? 'bg-primary text-white font-medium shadow-xs' : 'text-muted hover:text-white'"
            (click)="store.setActiveLayer('direct', null)"
          >
            DIRECT
          </button>
          <button
            type="button"
            class="flex-1 h-7 rounded-[5px] font-mono text-[11px] tracking-wider transition-all duration-150"
            [class]="store.activeLayer() === 'indirect' ? 'bg-primary text-white font-medium shadow-xs' : 'text-muted hover:text-white'"
            (click)="store.setActiveLayer('indirect')"
          >
            INDIRECT
          </button>
        </div>
      </div>

      <!-- Fixture Contribution Filter -->
      @if (activeDirectMatrices(); as directs) {
        @if (fixtureIds().length > 1 && store.activeLayer() === 'direct') {
          <div>
            <span class="block font-mono text-[11px] text-muted tracking-widest uppercase mb-1.5">
              Isolate Fixture Direct Flux
            </span>
            <div class="flex flex-wrap gap-1">
              <button
                type="button"
                class="px-2 py-0.5 rounded text-[11px] font-mono transition-colors"
                [class]="!store.activeFixtureFilter() ? 'bg-white text-black font-semibold' : 'border border-border text-muted hover:text-white'"
                (click)="store.setActiveLayer('direct', null)"
              >
                ALL
              </button>
              @for (fId of fixtureIds(); track fId) {
                <button
                  type="button"
                  class="px-2 py-0.5 rounded text-[11px] font-mono transition-colors"
                  [class]="store.activeFixtureFilter() === fId ? 'bg-primary text-white font-semibold' : 'border border-border text-muted hover:text-white'"
                  (click)="store.setActiveLayer('direct', fId)"
                >
                  {{ fId }}
                </button>
              }
            </div>
          </div>
        }
      }

      <!-- Palette Switcher -->
      <div>
        <span class="block font-mono text-[11px] text-muted tracking-widest uppercase mb-1.5" title="Switch false-color photometric distribution vs monochrome brand styling">
          Heatmap Palette
        </span>
        <div class="inline-flex w-full items-center p-0.5 rounded-lg border border-border/70 bg-[#0d0d0d]">
          <button
            type="button"
            class="flex-1 h-7 rounded-[5px] font-mono text-[11px] tracking-wider transition-all duration-150"
            [class]="store.activePalette() === 'false-color' ? 'bg-primary text-white font-medium shadow-xs' : 'text-muted hover:text-white'"
            (click)="store.setPalette('false-color')"
            title="Display standard false-color spectrum (Navy to Yellow to White)"
          >
            FALSE-COLOR
          </button>
          <button
            type="button"
            class="flex-1 h-7 rounded-[5px] font-mono text-[11px] tracking-wider transition-all duration-150"
            [class]="store.activePalette() === 'brand' ? 'bg-primary text-white font-medium shadow-xs' : 'text-muted hover:text-white'"
            (click)="store.setPalette('brand')"
            title="Display grayscale monochrome architectural palette"
          >
            MONOCHROME
          </button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrixLayersComponent {
  protected readonly store = inject(AdvancedStudyStore);

  protected readonly activeDirectMatrices = computed(() => {
    const vResult = this.store.currentVariantResult();
    return vResult?.directFloorMatrices ?? this.store.lastResult()?.directFloorMatrices ?? null;
  });

  protected readonly fixtureIds = computed(() => {
    const directs = this.activeDirectMatrices();
    if (!directs) return [];
    return Object.keys(directs);
  });
}
