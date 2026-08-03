import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResultStoreService } from '../../services/result-store.service';
import { PdfReportService } from '../../services/pdf-report.service';
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
export class ResultsPage implements OnInit {
  private readonly resultStore = inject(ResultStoreService);
  private readonly pdfService = inject(PdfReportService);

  protected readonly result = this.resultStore.calculationResult;
  protected readonly fixtureResults = this.resultStore.fixtureResults;
  protected readonly hasResult = computed(() => !!this.result());
  protected readonly compliantCount = computed(() => {
    const r = this.result();
    if (!r) return 0;
    return r.results.filter((item) => item.is_compliant).length;
  });

  ngOnInit() {
    this.resultStore.loadFixturesIfNeeded();
  }

  generateFullReport() {
    const r = this.result();
    if (!r) return;
    this.pdfService.generateFullReport(r, this.fixtureResults());
  }
}
