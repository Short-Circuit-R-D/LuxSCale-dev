import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { VariantResultDto } from '../../../../core/calculate/dtos/calculate-response.dto';
import { AdvancedStudyStore } from '../../stores/advanced-study.store';

@Component({
  selector: 'app-variant-comparison',
  imports: [DecimalPipe],
  template: `
    <div class="flex flex-col gap-6">
      @if (results().length > 1) {
        <div class="rounded-xl border border-border bg-surface p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <span class="font-mono text-xs text-primary tracking-widest uppercase">Multi-Variant Study</span>
              <h3 class="font-display text-xl text-white uppercase mt-0.5">Catalog Variants Benchmark</h3>
            </div>
            <span class="font-mono text-xs text-muted">{{ results().length }} variants evaluated</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-border font-mono text-[11px] text-muted tracking-wider uppercase">
                  <th class="py-3 px-4">Variant</th>
                  <th class="py-3 px-4">Avg Lux (Em)</th>
                  <th class="py-3 px-4">Uniformity (Uo)</th>
                  <th class="py-3 px-4">Power Density</th>
                  <th class="py-3 px-4">Compliance</th>
                  <th class="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/60">
                @for (variant of results(); track variant.variantId; let i = $index) {
                  <tr
                    class="font-body text-sm transition-colors hover:bg-elevated"
                    [class.bg-elevated]="store.selectedVariantIndex() === i"
                  >
                    <td class="py-3.5 px-4 font-mono font-medium text-white">
                      <div class="flex items-center gap-1.5">
                        <span>{{ variantName(variant.variantId) }}</span>
                        @if (isMainSolution(variant.variantId)) {
                          <span
                            class="px-1.5 py-0.5 rounded bg-[#1FA971]/20 text-[#1FA971] border border-[#1FA971]/30 text-[9px] font-semibold tracking-wide uppercase"
                            title="Can be used as a main solution"
                          >
                            Main
                          </span>
                        }
                      </div>
                      <span class="block text-[11px] text-muted font-normal">{{ variant.variantId }}</span>
                    </td>
                    <td class="py-3.5 px-4 font-mono text-white">
                      {{ variant.evaluation.average | number: '1.0-0' }} lx
                    </td>
                    <td class="py-3.5 px-4 font-mono text-white">
                      {{ variant.evaluation.uniformity | number: '1.2-2' }}
                    </td>
                    <td class="py-3.5 px-4 font-mono text-muted">
                      {{ variant.powerDensity ? (variant.powerDensity | number: '1.1-2') + ' W/m²' : '—' }}
                    </td>
                    <td class="py-3.5 px-4">
                      @if (variant.compliance) {
                        @if (variant.compliance.compliant) {
                          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1FA971]/10 text-[#1FA971] font-mono text-xs font-medium">
                            <span class="w-1.5 h-1.5 rounded-full bg-[#1FA971]"></span>
                            COMPLIANT
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono text-xs font-medium">
                            <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                            NON-COMPLIANT
                          </span>
                        }
                      } @else {
                        <span class="font-mono text-xs text-muted">—</span>
                      }
                    </td>
                    <td class="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        class="px-3 py-1.5 rounded-lg border font-mono text-xs tracking-wider transition-colors"
                        [class]="store.selectedVariantIndex() === i ? 'bg-white text-black border-white font-semibold' : 'border-border text-muted hover:text-white hover:border-[#3A3A3A]'"
                        (click)="store.selectVariant(i); store.setStudioTab('plan')"
                      >
                        {{ store.selectedVariantIndex() === i ? 'ACTIVE' : 'VIEW ON CANVAS' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Detailed Compliance Breakdown Card -->
      @if (compliance(); as comp) {
        <div class="rounded-xl border border-border bg-surface p-5">
          <div class="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <span class="font-mono text-xs text-primary tracking-widest uppercase">EN 12464 Standard</span>
              <h3 class="font-display text-xl text-white uppercase mt-0.5">Lighting Criteria Audit</h3>
            </div>
            <span
              class="px-3 py-1.5 rounded-lg font-mono text-xs font-semibold tracking-wider uppercase"
              [class]="comp.compliant ? 'bg-[#1FA971]/20 text-[#1FA971] border border-[#1FA971]/40' : 'bg-primary/20 text-primary border border-primary/40'"
            >
              {{ comp.compliant ? 'PASSED EN 12464' : 'FAILED EN 12464' }}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div class="p-4 rounded-lg bg-black border border-border">
              <span class="font-mono text-xs text-muted uppercase">Target Lux</span>
              <div class="mt-1 flex items-baseline gap-2">
                <span class="font-display text-2xl text-white">{{ comp.targetLux | number: '1.0-0' }}</span>
                <span class="font-mono text-xs text-muted">lx</span>
              </div>
              <span class="block mt-2 font-mono text-xs" [class]="comp.luxGap >= 0 ? 'text-[#1FA971]' : 'text-primary'">
                {{ comp.luxGap >= 0 ? '+' : '' }}{{ comp.luxGap | number: '1.0-0' }} lx margin
              </span>
            </div>

            <div class="p-4 rounded-lg bg-black border border-border">
              <span class="font-mono text-xs text-muted uppercase">Target Uniformity</span>
              <div class="mt-1 flex items-baseline gap-2">
                <span class="font-display text-2xl text-white">{{ comp.targetUniformity | number: '1.2-2' }}</span>
              </div>
              <span class="block mt-2 font-mono text-xs" [class]="comp.uniformityGap >= 0 ? 'text-[#1FA971]' : 'text-primary'">
                {{ comp.uniformityGap >= 0 ? '+' : '' }}{{ comp.uniformityGap | number: '1.2-2' }} margin
              </span>
            </div>

            <div class="p-4 rounded-lg bg-black border border-border">
              <span class="font-mono text-xs text-muted uppercase">Overdesign Ratio</span>
              <div class="mt-1 flex items-baseline gap-2">
                <span class="font-display text-2xl text-white">{{ comp.overdesign * 100 | number: '1.1-1' }}%</span>
              </div>
              <span class="block mt-2 font-mono text-xs text-muted">
                Max cap: 30%
              </span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantComparisonComponent {
  protected readonly store = inject(AdvancedStudyStore);

  protected readonly results = computed<VariantResultDto[]>(() => {
    return this.store.lastResult()?.results ?? [];
  });

  protected readonly compliance = computed(() => {
    const vResult = this.store.currentVariantResult();
    if (vResult) return vResult.compliance;
    return this.store.lastResult()?.compliance ?? null;
  });

  protected variantName(id: string): string {
    return this.store.selectedVariantsMap().get(id)?.name ?? id;
  }

  protected isMainSolution(id: string): boolean {
    const map = this.store.selectedVariantsMap();
    if (map.has(id)) {
      return !!map.get(id)?.fixture?.is_main_solution;
    }
    const fromCatalog = this.store.catalogVariants().find((v) => v.id === id);
    return !!fromCatalog?.fixture?.is_main_solution;
  }
}
