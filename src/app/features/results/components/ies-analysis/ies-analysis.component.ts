import { Component, effect, inject, input } from '@angular/core';
import { Fixture } from '../../../../services/fixtures.service';
import { CPlaneMetricsComponent } from './components/c-plane-metrics/c-plane-metrics.component';
import { CPlaneSelectorComponent } from './components/c-plane-selector/c-plane-selector.component';
import { PolarDistributionComponent } from './components/polar-distribution/polar-distribution.component';
import { SymmetryInterpreterComponent } from './components/symmetry-interpreter/symmetry-interpreter.component';
import { createIesStore } from './ies-analysis.store';

@Component({
  selector: 'app-ies-analysis',
  imports: [
    CPlaneSelectorComponent,
    CPlaneMetricsComponent,
    PolarDistributionComponent,
    SymmetryInterpreterComponent,
  ],
  templateUrl: './ies-analysis.component.html',
  styleUrl: './ies-analysis.component.css',
})
export class IesAnalysisComponent {
  fixture = input.required<Fixture>();

  protected readonly store = createIesStore();

  constructor() {
    effect(() => {
      const f = this.fixture();
      if (f?.ies_file) {
        this.store.loadIes(f.ies_file);
      }
    });
  }

  onAngleSelect(index: number) {
    this.store.selectCAngle(index);
  }
}
