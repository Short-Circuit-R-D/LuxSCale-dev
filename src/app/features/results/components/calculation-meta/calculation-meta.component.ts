import { Component, input } from '@angular/core';
import type { AutomateResponseDto } from '../../../../core/automate/dtos/automate-response.dto';

@Component({
  selector: 'app-calculation-meta',
  templateUrl: './calculation-meta.component.html',
  styleUrl: './calculation-meta.component.css',
})
export class CalculationMetaComponent {
  result = input.required<AutomateResponseDto>();
}
