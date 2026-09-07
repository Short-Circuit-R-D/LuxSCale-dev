import { Component, computed, inject, input, signal } from '@angular/core';
import { CalculationResult, UiSettings } from '../../../../services/calculation-result.service';
import { PdfReportService } from '../../../../services/pdf-report.service';
import { ResultStoreService, FixtureResult } from '../../../../services/result-store.service';
import { selectionLabel } from '../../../../shared/room-plan/layout-copy';
import { RoomPlanPreviewComponent } from '../../../../shared/room-plan/room-plan-preview.component';
import { CalculationsComponent } from '../calculations/calculations.component';
import { FixtureDetailsComponent } from '../fixture-details/fixture-details.component';

@Component({
  selector: 'app-results-grid',
  imports: [CalculationsComponent, FixtureDetailsComponent, RoomPlanPreviewComponent],
  templateUrl: './results-grid.component.html',
  styleUrl: './results-grid.component.css',
})
export class ResultsGridComponent {
  results = input.required<CalculationResult[]>();
  uiSettings = input.required<UiSettings>();
  fixtureResults = input.required<FixtureResult[]>();

  private readonly pdfService = inject(PdfReportService);
  private readonly resultStore = inject(ResultStoreService);

  protected readonly selectedIndex = signal(0);
  protected readonly activeView = signal<'calculations' | 'fixtures'>('calculations');
  protected readonly selectionLabel = selectionLabel;

  protected readonly calc = this.resultStore.calculationResult;
  protected readonly requestSides = computed(() => {
    const sides = this.resultStore.calculationRequest()?.sides;
    if (!sides || sides.length < 4) {
      return { width1: null, length1: null, width2: null, length2: null };
    }
    return {
      width1: sides[0],
      length1: sides[1],
      width2: sides[2],
      length2: sides[3],
    };
  });
  protected readonly layoutMode = computed((): 'auto' | 'user_grid' | null => {
    const mode = this.calc()?.calculation_meta.layout_mode;
    return mode === 'user_grid' || mode === 'auto' ? mode : null;
  });

  protected readonly selectedResult = computed(() => this.results()[this.selectedIndex()]);

  protected readonly selectedFixtureResult = computed(() => {
    const result = this.selectedResult();
    if (!result) return null;

    const luminaire = result['Luminaire'] as string;
    const power = result['Power (W)'] as number;

    return (
      this.fixtureResults().find((fr) => fr.key.luminaire === luminaire && fr.key.power === power) ??
      null
    );
  });

  protected readonly resultImages = computed(() => {
    const fixtureMap = new Map<string, string>();
    for (const fr of this.fixtureResults()) {
      const key = `${fr.key.luminaire}|${fr.key.power}`;
      if (fr.fixtures.length > 0 && fr.fixtures[0].product.images.length > 0) {
        fixtureMap.set(key, fr.fixtures[0].product.images[0]);
      }
    }

    return this.results().map((r) => {
      const luminaire = r['Luminaire'] as string;
      const power = r['Power (W)'] as number;
      return fixtureMap.get(`${luminaire}|${power}`) ?? null;
    });
  });

  selectResult(index: number) {
    this.selectedIndex.set(index);
    this.activeView.set('calculations');
  }

  setActiveView(view: 'calculations' | 'fixtures') {
    this.activeView.set(view);
  }

  generateSolutionReport() {
    const response = this.resultStore.calculationResult();
    const result = this.selectedResult();
    const fixtureResult = this.selectedFixtureResult();
    if (!response || !result) return;
    this.pdfService.generateSolutionReport(response, result, fixtureResult ?? null);
  }
}
