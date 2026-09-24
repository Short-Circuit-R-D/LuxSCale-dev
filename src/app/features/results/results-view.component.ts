import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { StoredAutomateStudy } from '../../services/result-store.service';
import type { VariantDetailResponseDto } from '../../core/variants/dtos/variants.dto';
import { CalculationMetaComponent } from './components/calculation-meta/calculation-meta.component';
import { ProjectInfoComponent } from './components/project-info/project-info.component';
import { ResultsGridComponent } from './components/results-grid/results-grid.component';
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
  readonly study = input.required<StoredAutomateStudy>();
  readonly variants = input.required<Map<string, VariantDetailResponseDto>>();
  readonly showNewStudy = input(true);
  readonly heading = input('');

  protected readonly title = computed(
    () => this.heading() || this.study().project?.projectName || 'Lighting study',
  );

  protected readonly subtitle = computed(() => {
    const project = this.study().project;
    const activity = this.study().standard?.activity;
    if (project && activity) {
      return `${project.companyName} — ${activity}`;
    }
    return project?.companyName ?? activity ?? '';
  });

  protected readonly compliantCount = computed(
    () => this.study().response.solutions.filter((item) => item.recommended).length,
  );

  protected readonly bounds = computed(() => {
    const polygon = this.study().request.polygon;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of polygon) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    if (!Number.isFinite(minX)) {
      return { length: 0, width: 0 };
    }
    return { length: maxX - minX, width: maxY - minY };
  });

  protected readonly standardRef = computed(
    () => this.study().standard?.hierarchy.ref_number ?? '—',
  );
}
