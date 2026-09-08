import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CalculationResponse } from '../../../../services/calculation-result.service';
import { PdfReportService } from '../../../../services/pdf-report.service';
import { FixtureResult } from '../../../../services/result-store.service';
import { selectionLabel } from '../../../../shared/room-plan/layout-copy';
import { RoomPlanPreviewComponent } from '../../../../shared/room-plan/room-plan-preview.component';
import { Point } from '../../../../shared/room-plan/room-polygon';
import { CalculationsComponent } from '../calculations/calculations.component';
import { FixtureDetailsComponent } from '../fixture-details/fixture-details.component';

export interface RequestSides {
  width1: number | null;
  length1: number | null;
  width2: number | null;
  length2: number | null;
}

export const EMPTY_REQUEST_SIDES: RequestSides = {
  width1: null,
  length1: null,
  width2: null,
  length2: null,
};

export function requestSidesFromPayload(sides: number[] | null | undefined): RequestSides {
  if (!sides || sides.length < 4) {
    return EMPTY_REQUEST_SIDES;
  }
  return {
    width1: sides[0],
    length1: sides[1],
    width2: sides[2],
    length2: sides[3],
  };
}

@Component({
  selector: 'app-results-grid',
  imports: [CalculationsComponent, FixtureDetailsComponent, RoomPlanPreviewComponent],
  templateUrl: './results-grid.component.html',
  styleUrl: './results-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsGridComponent {
  calculation = input.required<CalculationResponse>();
  fixtureResults = input.required<FixtureResult[]>();
  requestSides = input<RequestSides>(EMPTY_REQUEST_SIDES);
  vertices = input<readonly Point[] | null>(null);
  holes = input<readonly Point[][] | null>(null);

  private readonly pdfService = inject(PdfReportService);

  protected readonly selectedIndex = signal(0);
  protected readonly activeView = signal<'calculations' | 'fixtures'>('calculations');
  protected readonly selectionLabel = selectionLabel;

  protected readonly results = computed(() => this.calculation().results);
  protected readonly layoutMode = computed((): 'auto' | 'user_grid' | null => {
    const mode = this.calculation().calculation_meta.layout_mode;
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
    const result = this.selectedResult();
    const fixtureResult = this.selectedFixtureResult();
    if (!result) return;
    this.pdfService.generateSolutionReport(this.calculation(), result, fixtureResult ?? null);
  }
}
