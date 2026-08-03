import { Component, input } from '@angular/core';
import { CalculationMeta } from '../../../../services/calculation-result.service';

@Component({
  selector: 'app-calculation-meta',
  templateUrl: './calculation-meta.component.html',
  styleUrl: './calculation-meta.component.css',
})
export class CalculationMetaComponent {
  meta = input.required<CalculationMeta>();
}
