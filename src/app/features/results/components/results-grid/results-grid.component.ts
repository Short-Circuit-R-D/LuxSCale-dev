import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { CalculationResult, UiSettings } from '../../../../services/calculation-result.service';

@Component({
  selector: 'app-results-grid',
  imports: [DecimalPipe],
  templateUrl: './results-grid.component.html',
  styleUrl: './results-grid.component.css',
})
export class ResultsGridComponent {
  results = input.required<CalculationResult[]>();
  uiSettings = input.required<UiSettings>();

  protected readonly selectedIndex = signal(0);

  protected readonly selectedResult = computed(() => this.results()[this.selectedIndex()]);

  selectResult(index: number) {
    this.selectedIndex.set(index);
  }
}
