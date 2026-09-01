import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CadViewerStore } from './cad-viewer.store';
import { CadLegendComponent } from './components/cad-legend/cad-legend.component';
import { CadPlanComponent } from './components/cad-plan/cad-plan.component';
import { CadUploadComponent } from './components/cad-upload/cad-upload.component';

@Component({
  selector: 'app-cad-study',
  imports: [RouterLink, CadUploadComponent, CadPlanComponent, CadLegendComponent],
  templateUrl: './cad-study.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CadStudyPage implements OnInit {
  protected readonly store = inject(CadViewerStore);

  ngOnInit(): void {
    this.store.checkHealth();
    this.store.restoreSession();
  }
}
