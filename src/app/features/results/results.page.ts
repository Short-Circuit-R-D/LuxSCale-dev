import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResultStoreService } from '../../services/result-store.service';
import { requestSidesFromPayload } from './components/results-grid/results-grid.component';
import { ResultsViewComponent } from './results-view.component';

@Component({
  selector: 'app-results',
  imports: [RouterLink, ResultsViewComponent],
  templateUrl: './results.page.html',
  styleUrl: './results.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsPage implements OnInit {
  private readonly resultStore = inject(ResultStoreService);

  protected readonly result = this.resultStore.calculationResult;
  protected readonly fixtureResults = this.resultStore.fixtureResults;
  protected readonly fallbackFields = this.resultStore.fallbackFields;
  protected readonly hasResult = computed(() => !!this.result());
  protected readonly requestSides = computed(() =>
    requestSidesFromPayload(this.resultStore.calculationRequest()?.sides),
  );

  ngOnInit() {
    this.resultStore.loadFixturesIfNeeded();
  }
}
