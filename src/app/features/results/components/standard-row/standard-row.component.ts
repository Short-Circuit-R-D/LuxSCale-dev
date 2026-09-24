import { Component, input } from '@angular/core';
import type { StandardResponseDto } from '../../../../core/standards/dtos/standards.dto';

@Component({
  selector: 'app-standard-row',
  templateUrl: './standard-row.component.html',
  styleUrl: './standard-row.component.css',
})
export class StandardRowComponent {
  standard = input.required<StandardResponseDto | null>();

  protected param(value: number | null | undefined): string {
    return value == null ? '—' : String(value);
  }
}
