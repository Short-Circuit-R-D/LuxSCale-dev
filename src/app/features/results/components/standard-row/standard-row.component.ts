import { Component, input } from '@angular/core';
import { StandardLighting } from '../../../../services/calculation-result.service';

@Component({
  selector: 'app-standard-row',
  templateUrl: './standard-row.component.html',
  styleUrl: './standard-row.component.css',
})
export class StandardRowComponent {
  standard = input.required<StandardLighting>();
  fallbackFields = input<Set<string>>(new Set());

  readonly fieldLabels: Record<string, string> = {
    Em_r_lx: 'Maintained illuminance (Em)',
    Em_u_lx: 'Useful illuminance',
    Uo: 'Uniformity (Uo)',
    Ra: 'Color Rendering (Ra)',
    RUGL: 'RUGL',
    Ez_lx: 'Ez',
    Em_wall_lx: 'Wall illuminance',
    Em_ceiling_lx: 'Ceiling illuminance',
  };

  isFallback(field: string): boolean {
    return this.fallbackFields().has(field);
  }
}
