import { Component, input } from '@angular/core';
import { ProjectInfo } from '../../../../services/calculation-result.service';

@Component({
  selector: 'app-project-info',
  templateUrl: './project-info.component.html',
  styleUrl: './project-info.component.css',
})
export class ProjectInfoComponent {
  projectInfo = input.required<ProjectInfo>();
}
