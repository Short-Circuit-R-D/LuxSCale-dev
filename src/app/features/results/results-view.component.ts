import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalculationResponse } from '../../services/calculation-result.service';
import { PdfReportService } from '../../services/pdf-report.service';
import { FixtureResult } from '../../services/result-store.service';
import { Point } from '../../shared/room-plan/room-polygon';
import { CalculationMetaComponent } from './components/calculation-meta/calculation-meta.component';
import { ProjectInfoComponent } from './components/project-info/project-info.component';
import {
  EMPTY_REQUEST_SIDES,
  RequestSides,
  ResultsGridComponent,
} from './components/results-grid/results-grid.component';
import { RoomDimensionsComponent } from './components/room-dimensions/room-dimensions.component';
import { StandardRowComponent } from './components/standard-row/standard-row.component';

@Component({
  selector: 'app-results-view',
  imports: [
    RouterLink,
    DecimalPipe,
    CalculationMetaComponent,
    ProjectInfoComponent,
    ResultsGridComponent,
    RoomDimensionsComponent,
    StandardRowComponent,
  ],
  templateUrl: './results-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsViewComponent {
  private readonly pdfService = inject(PdfReportService);

  readonly result = input.required<CalculationResponse>();
  readonly fixtureResults = input.required<FixtureResult[]>();
  readonly fallbackFields = input<Set<string>>(new Set());
  readonly requestSides = input<RequestSides>(EMPTY_REQUEST_SIDES);
  readonly vertices = input<readonly Point[] | null>(null);
  readonly holes = input<readonly Point[][] | null>(null);
  readonly showNewStudy = input(true);
  readonly heading = input('');

  protected readonly title = computed(
    () => this.heading() || this.result().project_info.project_name,
  );
  protected readonly compliantCount = computed(
    () => this.result().results.filter((item) => item.is_compliant).length,
  );

  generateFullReport() {
    this.pdfService.generateFullReport(this.result(), this.fixtureResults());
  }
}
