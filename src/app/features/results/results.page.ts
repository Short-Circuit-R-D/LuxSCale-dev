import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResultStoreService } from '../../services/result-store.service';
import { ResultsViewComponent } from './results-view.component';

@Component({
  selector: 'app-results',
  imports: [RouterLink, ResultsViewComponent],
  templateUrl: './results.page.html',
  styleUrl: './results.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsPage {
  private readonly resultStore = inject(ResultStoreService);

  protected readonly study = this.resultStore.study;
  protected readonly variants = this.resultStore.variantHeaders;
  protected readonly hasResult = computed(() => !!this.study());
}
