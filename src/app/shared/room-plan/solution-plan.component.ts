import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AutomateFloorPatchDto } from '../../core/automate/dtos/automate-response.dto';
import type {
  AutomateFixtureGeometryDto,
  AutomatePlacementDto,
} from '../../core/automate/dtos/automate-response.dto';
import { luxFill } from './heatmap-render';
import { svgPathFromRings, type Point } from './room-polygon';

interface PatchRect {
  x: number;
  y: number;
  size: number;
  fill: string;
}

/** Plan view for one automate solution (§4): room ring, patch heatmap, fixtures. */
@Component({
  selector: 'app-solution-plan',
  templateUrl: './solution-plan.component.html',
  styleUrl: './solution-plan.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolutionPlanComponent {
  readonly polygon = input<readonly Point[] | null>(null);
  readonly patches = input<readonly AutomateFloorPatchDto[]>([]);
  /** 1:1 with `patches` (§4). */
  readonly values = input<readonly number[] | null>(null);
  readonly minLux = input(0);
  readonly avgLux = input(0);
  readonly maxLux = input(0);
  readonly fixtures = input<readonly AutomateFixtureGeometryDto[]>([]);
  readonly placements = input<readonly AutomatePlacementDto[]>([]);
  readonly chrome = input(true);

  protected readonly caption = computed(() => {
    if (this.values() == null) {
      return null;
    }
    return `${formatLux(this.minLux())} / ${formatLux(this.avgLux())} / ${formatLux(this.maxLux())} lx`;
  });

  protected readonly ariaLabel = computed(() => {
    if (this.values() == null) {
      return 'Lighting layout plan';
    }
    return `Lighting layout plan. Minimum ${formatLux(this.minLux())} lux, average ${formatLux(this.avgLux())} lux, maximum ${formatLux(this.maxLux())} lux.`;
  });

  protected readonly view = computed(() => {
    const polygon = this.polygon() ?? [];
    const patches = this.patches();
    const values = this.values();
    const fixtures = this.fixtures();
    const placements = this.placements();
    if (polygon.length < 3 && patches.length === 0 && fixtures.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const grow = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };
    for (const point of polygon) {
      grow(point.x, point.y);
    }
    for (const fixture of fixtures) {
      for (const corner of fixture.corners) {
        grow(corner.x, corner.y);
      }
      grow(fixture.position.x, fixture.position.y);
    }
    for (const placement of placements) {
      grow(placement.x, placement.y);
    }
    for (const patch of patches) {
      grow(patch.center.x - patch.size / 2, patch.center.y - patch.size / 2);
      grow(patch.center.x + patch.size / 2, patch.center.y + patch.size / 2);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return null;
    }
    const spanX = Math.max(maxX - minX, 0.01);
    const spanY = Math.max(maxY - minY, 0.01);
    const flip = (y: number) => maxY - y;
    const fixtureR = Math.min(spanX, spanY) * 0.022;
    const pad = Math.max(Math.max(spanX, spanY) * 0.1, 0.4);

    const min = this.minLux();
    const max = this.maxLux();
    const rects: PatchRect[] = values
      ? patches.map((patch, i) => {
          const lux = values[i];
          return {
            x: patch.center.x - patch.size / 2,
            y: flip(patch.center.y + patch.size / 2),
            size: patch.size,
            fill: Number.isFinite(lux) ? luxFill(lux, min, max) : 'transparent',
          };
        })
      : [];

    return {
      viewBox: `${minX - pad} ${flip(maxY) - pad} ${spanX + pad * 2} ${spanY + pad * 2}`,
      path: polygon.length >= 3 ? svgPathFromRings(polygon, [], flip) : '',
      rects,
      quads: fixtures.map((fixture) =>
        fixture.corners.map((c) => `${c.x},${flip(c.y)}`).join(' '),
      ),
      dots: placements.map((p) => ({ x: p.x, y: flip(p.y) })),
      fixtureR,
      legendMin: formatLux(min),
      legendAvg: formatLux(this.avgLux()),
      legendMax: formatLux(max),
    };
  });
}

function formatLux(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : '—';
}
