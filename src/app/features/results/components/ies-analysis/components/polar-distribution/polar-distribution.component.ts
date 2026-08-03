import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-polar-distribution',
  templateUrl: './polar-distribution.component.html',
  styleUrl: './polar-distribution.component.css',
})
export class PolarDistributionComponent {
  verticalAngles = input.required<number[]>();
  candelaValues = input.required<number[]>();
  maxCandela = input.required<number>();
  selectedAngle = input.required<number>();

  protected readonly svgSize = 400;
  protected readonly center = 200;
  protected readonly maxRadius = 160;

  protected readonly outerValue = computed(() => {
    const max = this.maxCandela();
    if (max === 0) return 500;
    return Math.ceil(max / 500) * 500;
  });

  protected readonly scaleSteps = computed(() => {
    const outer = this.outerValue();
    const rawStep = outer / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    let niceStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    if (niceStep < 500) niceStep = 500;
    const steps: number[] = [];
    for (let i = niceStep; i < outer; i += niceStep) {
      steps.push(Math.round(i));
    }
    steps.push(outer);
    return steps;
  });

  protected readonly angleLabels = computed(() => {
    const labels: { angle: number; x: number; y: number; label: string }[] = [];
    const angles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345];

    for (const angle of angles) {
      const rad = ((angle - 90) * Math.PI) / 180;
      const r = this.maxRadius + 20;
      const x = this.center + r * Math.cos(rad);
      const y = this.center + r * Math.sin(rad);
      labels.push({ angle, x, y, label: `${angle}°` });
    }
    return labels;
  });

  protected readonly radialLines = computed(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let angle = 0; angle < 360; angle += 15) {
      const rad = ((angle - 90) * Math.PI) / 180;
      lines.push({
        x1: this.center,
        y1: this.center,
        x2: this.center + this.maxRadius * Math.cos(rad),
        y2: this.center + this.maxRadius * Math.sin(rad),
      });
    }
    return lines;
  });

  protected readonly curvePath = computed(() => {
    const values = this.candelaValues();
    const angles = this.verticalAngles();
    const outer = this.outerValue();
    if (values.length === 0 || outer === 0) return '';

    const points: string[] = [];
    for (let i = 0; i < values.length; i++) {
      const gamma = angles[i];
      const r = (values[i] / outer) * this.maxRadius;
      const rad = ((gamma - 90) * Math.PI) / 180;
      const x = this.center + r * Math.cos(rad);
      const y = this.center + r * Math.sin(rad);
      points.push(`${x},${y}`);
    }

    for (let i = values.length - 1; i >= 0; i--) {
      const gamma = angles[i];
      const r = (values[i] / outer) * this.maxRadius;
      const rad = ((-gamma - 90) * Math.PI) / 180;
      const x = this.center + r * Math.cos(rad);
      const y = this.center + r * Math.sin(rad);
      points.push(`${x},${y}`);
    }

    return `M ${points.join(' L ')} Z`;
  });

  protected readonly scaleLabels = computed(() => {
    const steps = this.scaleSteps();
    return steps.map((val) => ({
      value: val,
      x: this.center + (val / this.outerValue()) * this.maxRadius,
    }));
  });

  protected readonly connectingLines = computed(() => {
    const steps = this.scaleSteps();
    const labelY = this.center + this.maxRadius + 30;
    return steps.map((val) => ({
      x: this.center + (val / this.outerValue()) * this.maxRadius,
      y1: this.center + (val / this.outerValue()) * this.maxRadius,
      y2: labelY - 2,
    }));
  });
}
