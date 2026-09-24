import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PolygonHeatmap } from '../../services/luxscale.service';
import {
  heatmapDataUrl,
  heatmapImageBox,
  heatmapImageMatrix,
  rotatePoint,
} from './heatmap-render';
import { parseFixtureCoordinates, svgPathFromRings, type Point } from './room-polygon';

@Component({
  selector: 'app-heatmap-preview',
  templateUrl: './heatmap-preview.component.html',
  styleUrl: './heatmap-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeatmapPreviewComponent {
  readonly heatmap = input<PolygonHeatmap | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly vertices = input<readonly Point[] | null>(null);
  readonly holes = input<readonly Point[][] | null>(null);
  readonly chrome = input(true);

  protected readonly caption = computed(() => {
    const heatmap = this.heatmap();
    if (!heatmap) {
      return null;
    }
    return `U₀ ${formatU0(heatmap.U0)}  ·  ${formatLux(heatmap.E_min)} / ${formatLux(heatmap.E_avg)} / ${formatLux(heatmap.E_max)} lx`;
  });

  protected readonly ariaLabel = computed(() => {
    const heatmap = this.heatmap();
    if (!heatmap) {
      return 'Illuminance heatmap';
    }
    return `Illuminance heatmap. Uniformity U0 ${formatU0(heatmap.U0)}. Minimum ${formatLux(heatmap.E_min)} lux, average ${formatLux(heatmap.E_avg)} lux, maximum ${formatLux(heatmap.E_max)} lux.`;
  });

  protected readonly view = computed(() => {
    const heatmap = this.heatmap();
    if (!heatmap) {
      return null;
    }
    const box = heatmapImageBox(heatmap);
    const href = heatmapDataUrl(heatmap);
    if (!box || !href) {
      return null;
    }
    const fixtures = parseFixtureCoordinates(heatmap.fixture_positions);
    const vertices = this.vertices() ?? [];
    const holes = this.holes() ?? [];
    const theta = Number.isFinite(heatmap.orientation_rad) ? heatmap.orientation_rad : 0;
    const corners = [
      rotatePoint(box.x, box.y, theta),
      rotatePoint(box.x + box.w, box.y, theta),
      rotatePoint(box.x + box.w, box.y + box.h, theta),
      rotatePoint(box.x, box.y + box.h, theta),
    ];
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
    for (const point of [...corners, ...fixtures, ...vertices]) {
      grow(point.x, point.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return null;
    }
    const spanX = Math.max(maxX - minX, 0.01);
    const spanY = Math.max(maxY - minY, 0.01);
    const flip = (y: number) => maxY - y;
    const fixtureR = Math.min(spanX, spanY) * 0.022;
    const pad = Math.max(Math.max(spanX, spanY) * 0.1, 0.4);
    return {
      viewBox: `${minX - pad} ${flip(maxY) - pad} ${spanX + pad * 2} ${spanY + pad * 2}`,
      path: vertices.length >= 3 ? svgPathFromRings(vertices, holes, flip) : '',
      imageHref: href,
      imageW: box.w,
      imageH: box.h,
      imageTransform: heatmapImageMatrix(box, theta, maxY),
      fixtures: fixtures.map((point) => ({ x: point.x, y: flip(point.y) })),
      fixtureR,
      legendMin: formatLux(heatmap.E_min),
      legendAvg: formatLux(heatmap.E_avg),
      legendMax: formatLux(heatmap.E_max),
      legendU0: formatU0(heatmap.U0),
    };
  });
}

function formatLux(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : '—';
}

function formatU0(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '—';
}
