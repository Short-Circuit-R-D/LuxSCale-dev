import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-c-plane-metrics',
  imports: [DecimalPipe],
  templateUrl: './c-plane-metrics.component.html',
  styleUrl: './c-plane-metrics.component.css',
})
export class CPlaneMetricsComponent {
  selectedAngle = input.required<number>();
  peakCandela = input<{ value: number; angle: number } | null>();
  beamAngle = input<{ beamAngle: number; leftAngle: number; rightAngle: number } | null>();
  fieldAngle = input<{ fieldAngle: number; leftAngle: number; rightAngle: number } | null>();
}
