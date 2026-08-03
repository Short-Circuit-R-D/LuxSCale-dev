import { Component, input } from '@angular/core';

@Component({
  selector: 'app-symmetry-interpreter',
  templateUrl: './symmetry-interpreter.component.html',
  styleUrl: './symmetry-interpreter.component.css',
})
export class SymmetryInterpreterComponent {
  symmetryType = input.required<string>();
  symmetryDescription = input.required<string>();
}
