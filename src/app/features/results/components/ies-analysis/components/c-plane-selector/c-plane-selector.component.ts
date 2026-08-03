import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-c-plane-selector',
  templateUrl: './c-plane-selector.component.html',
  styleUrl: './c-plane-selector.component.css',
})
export class CPlaneSelectorComponent {
  horizontalAngles = input.required<number[]>();
  selectedIndex = input.required<number>();
  angleSelected = output<number>();
}
