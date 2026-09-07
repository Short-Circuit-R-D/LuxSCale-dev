import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { CalculationResult, UiSettings } from '../../../../services/calculation-result.service';
import { extraClearanceNote, selectionLabel } from '../../../../shared/room-plan/layout-copy';

@Component({
  selector: 'app-calculations',
  imports: [DecimalPipe],
  templateUrl: './calculations.component.html',
  styleUrl: './calculations.component.css',
})
export class CalculationsComponent {
  result = input.required<CalculationResult>();
  uiSettings = input.required<UiSettings>();

  protected readonly selectionLabel = selectionLabel;
  protected readonly extraClearanceNote = extraClearanceNote;
}
