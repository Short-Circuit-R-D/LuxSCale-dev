import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { automateStatusFor } from '../../../../core/automate/automate-status';
import type {
  AutomateResponseDto,
  AutomateSolutionDto,
} from '../../../../core/automate/dtos/automate-response.dto';
import type { VariantDetailResponseDto } from '../../../../core/variants/dtos/variants.dto';
import { SolutionPlanComponent } from '../../../../shared/room-plan/solution-plan.component';
import type { Point } from '../../../../shared/room-plan/room-polygon';
import { CalculationsComponent } from '../calculations/calculations.component';
import { FixtureDetailsComponent } from '../fixture-details/fixture-details.component';

@Component({
  selector: 'app-results-grid',
  imports: [DecimalPipe, CalculationsComponent, FixtureDetailsComponent, SolutionPlanComponent],
  templateUrl: './results-grid.component.html',
  styleUrl: './results-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsGridComponent {
  result = input.required<AutomateResponseDto>();
  variants = input.required<Map<string, VariantDetailResponseDto>>();
  polygon = input<readonly Point[] | null>(null);

  protected readonly selectedIndex = signal(0);
  protected readonly activeView = signal<'calculations' | 'fixtures'>('calculations');
  protected readonly showMiss = signal(false);

  protected readonly status = computed(() => automateStatusFor(this.result()));

  protected readonly solutions = computed(() => this.result().solutions);

  protected readonly selectedSolution = computed<AutomateSolutionDto | null>(
    () => this.solutions()[this.selectedIndex()] ?? null,
  );

  protected readonly selectedVariant = computed(
    () => this.variants().get(this.selectedSolution()?.variantId ?? '') ?? null,
  );

  protected variantName(variantId: string): string {
    return this.variants().get(variantId)?.name ?? variantId;
  }

  selectResult(index: number) {
    this.selectedIndex.set(index);
    this.activeView.set('calculations');
  }

  setActiveView(view: 'calculations' | 'fixtures') {
    this.activeView.set(view);
  }

  toggleMiss() {
    this.showMiss.update((v) => !v);
  }
}
