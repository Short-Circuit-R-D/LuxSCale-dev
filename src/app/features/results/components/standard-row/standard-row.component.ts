import { Component, input } from '@angular/core';
import { StandardLighting } from '../../../../services/calculation-result.service';

@Component({
  selector: 'app-standard-row',
  templateUrl: './standard-row.component.html',
  styleUrl: './standard-row.component.css',
})
export class StandardRowComponent {
  standard = input.required<StandardLighting>();
}
