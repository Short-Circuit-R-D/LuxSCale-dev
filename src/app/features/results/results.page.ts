import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalculationResultService } from '../../services/calculation-result.service';
import { CalculationMetaComponent } from './components/calculation-meta/calculation-meta.component';
import { ProjectInfoComponent } from './components/project-info/project-info.component';
import { ResultsGridComponent } from './components/results-grid/results-grid.component';
import { RoomDimensionsComponent } from './components/room-dimensions/room-dimensions.component';
import { StandardRowComponent } from './components/standard-row/standard-row.component';

@Component({
  selector: 'app-results',
  imports: [
    RouterLink,
    DecimalPipe,
    CalculationMetaComponent,
    ProjectInfoComponent,
    ResultsGridComponent,
    RoomDimensionsComponent,
    StandardRowComponent,
  ],
  templateUrl: './results.page.html',
  styleUrl: './results.page.css',
})
export class ResultsPage {
  private readonly resultService = inject(CalculationResultService);

  protected readonly result = this.resultService.result;
  protected readonly hasResult = computed(() => !!this.result());
  protected readonly compliantCount = computed(() => {
    const r = this.result();
    if (!r) return 0;
    return r.results.filter((item) => item.is_compliant).length;
  });
}
