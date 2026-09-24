import { Component, input } from '@angular/core';
import type { AutomateProjectMeta } from '../../../../services/result-store.service';

@Component({
  selector: 'app-project-info',
  templateUrl: './project-info.component.html',
  styleUrl: './project-info.component.css',
})
export class ProjectInfoComponent {
  projectInfo = input.required<AutomateProjectMeta | null>();
}
