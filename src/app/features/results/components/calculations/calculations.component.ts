import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import type { AutomateSolutionDto } from '../../../../core/automate/dtos/automate-response.dto';
import type { VariantDetailResponseDto } from '../../../../core/variants/dtos/variants.dto';

@Component({
  selector: 'app-calculations',
  imports: [DecimalPipe],
  templateUrl: './calculations.component.html',
  styleUrl: './calculations.component.css',
})
export class CalculationsComponent {
  solution = input.required<AutomateSolutionDto>();
  variant = input<VariantDetailResponseDto | null>(null);

  protected lumensText(): string {
    const variant = this.variant();
    if (!variant) return '—';
    return Math.round(variant.power * variant.efficacy).toLocaleString('en-US');
  }

  protected powerText(): string {
    const power = this.solution().powerW;
    return power == null ? '—' : `${Math.round(power).toLocaleString('en-US')}`;
  }

  protected powerDensityText(): string {
    const density = this.solution().powerDensity;
    return density == null ? '—' : String(Math.round(density * 100) / 100);
  }
}
