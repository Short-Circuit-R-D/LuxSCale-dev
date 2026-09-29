import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { FreeFixtureDto } from '../../../../core/calculate/dtos/calculate-request.dto';
import type { Point2D } from '../../utils/fixture-patterns';

interface PreviewFixture {
  id: string;
  cx: number;
  cy: number;
  rotation: number;
  cornersStr: string;
  rotEndX: number;
  rotEndY: number;
  rotTickLeftX: number;
  rotTickLeftY: number;
  rotTickRightX: number;
  rotTickRightY: number;
}

@Component({
  selector: 'app-pattern-preview',
  template: `
    <div class="flex flex-col rounded-xl border border-border bg-[#0a0a0a] p-3 sm:p-4">
      <div class="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border/60">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-primary inline-block"></span>
          <span class="font-mono text-xs tracking-wider text-white uppercase font-semibold">
            Pattern 2D Layout Preview
          </span>
        </div>
        <span class="px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 font-mono text-[11px] text-primary font-bold">
          {{ fixtures().length }} luminaires placed
        </span>
      </div>

      @if (view(); as v) {
        <div class="relative w-full aspect-[4/3] bg-black/60 rounded-lg overflow-hidden border border-border/40 flex items-center justify-center">
          <svg
            class="w-full h-full select-none"
            [attr.viewBox]="v.viewBox"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- Room Polygon Perimeter -->
            <polygon
              [attr.points]="v.polyPointsStr"
              fill="rgba(255, 255, 255, 0.03)"
              stroke="#FFFFFF"
              stroke-width="2"
              stroke-linejoin="round"
            />

            <!-- Luminaires -->
            @for (f of v.screenFixtures; track f.id) {
              <g class="cursor-pointer group">
                <!-- Luminaire Opening Body (physically rotated) -->
                <polygon
                  [attr.points]="f.cornersStr"
                  fill="#F0A202"
                  stroke="#FFFFFF"
                  stroke-width="1.2"
                  fill-opacity="0.85"
                />

                <!-- Central anchor dot -->
                <circle
                  [attr.cx]="f.cx"
                  [attr.cy]="f.cy"
                  r="2.5"
                  fill="#FFFFFF"
                  stroke="#000000"
                  stroke-width="0.8"
                />

                <!-- Distinctive Rotation Indicator (visible even when tilt is 0°) -->
                <!-- Directional azimuth pointer line -->
                <line
                  [attr.x1]="f.cx"
                  [attr.y1]="f.cy"
                  [attr.x2]="f.rotEndX"
                  [attr.y2]="f.rotEndY"
                  stroke="#38BDF8"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <!-- Arrowhead / Orientation marker at tip -->
                <polygon
                  [attr.points]="f.rotEndX + ',' + f.rotEndY + ' ' + f.rotTickLeftX + ',' + f.rotTickLeftY + ' ' + f.rotTickRightX + ',' + f.rotTickRightY"
                  fill="#38BDF8"
                  stroke="#000000"
                  stroke-width="0.5"
                />

                <!-- Identifier Label -->
                <text
                  [attr.x]="f.cx"
                  [attr.y]="f.cy - 11"
                  text-anchor="middle"
                  class="font-mono text-[9px] fill-white pointer-events-none select-none"
                  style="text-shadow: 0 1px 3px rgba(0,0,0,0.9)"
                >
                  {{ f.id }}
                </text>
              </g>
            }
          </svg>

          <!-- Legend note -->
          <div class="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded border border-border/60 flex items-center gap-1.5 pointer-events-none">
            <span class="w-3 h-0.5 bg-[#38BDF8] inline-block"></span>
            <span class="font-mono text-[10px] text-muted">Azimuth Rotation Direction (C0 Axis)</span>
          </div>
        </div>
      } @else {
        <div class="flex items-center justify-center p-8 text-muted font-mono text-xs text-center border border-dashed border-border rounded-lg">
          No valid room geometry defined. Enter room dimensions in Step 1.
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatternPreviewComponent {
  readonly polygon = input.required<Point2D[]>();
  readonly fixtures = input.required<FreeFixtureDto[]>();

  protected readonly view = computed(() => {
    const poly = this.polygon();
    const list = this.fixtures();
    if (!poly || poly.length < 3) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const spanX = Math.max(0.01, maxX - minX);
    const spanY = Math.max(0.01, maxY - minY);
    const pad = Math.max(0.8, Math.max(spanX, spanY) * 0.12);

    const Wv = 600;
    const Hv = 450;
    const S = Math.min((Wv - 2 * 30) / (spanX + 2 * pad), (Hv - 2 * 30) / (spanY + 2 * pad));
    const Ox = (Wv - spanX * S) / 2 - minX * S;
    const Oy = (Hv + spanY * S) / 2 + minY * S;

    const toScreen = (x: number, y: number) => ({
      sx: x * S + Ox,
      sy: Oy - y * S,
    });

    const polyPointsStr = poly.map((p) => {
      const { sx, sy } = toScreen(p.x, p.y);
      return `${sx},${sy}`;
    }).join(' ');

    const lumHalf = Math.max(6, Math.min(14, 0.3 * S));
    const ptrLen = lumHalf + 8;
    const arrowW = 4;

    const screenFixtures: PreviewFixture[] = list.map((f, idx) => {
      const { sx: cx, sy: cy } = toScreen(f.x, f.y);
      const rot = (f.rotation ?? 0);
      const rotRad = rot * (Math.PI / 180);

      // Rotate body rectangle
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);
      const localCorners = [
        { x: -lumHalf, y: -lumHalf },
        { x: lumHalf, y: -lumHalf },
        { x: lumHalf, y: lumHalf },
        { x: -lumHalf, y: lumHalf },
      ];
      const cornersStr = localCorners.map((c) => {
        const rx = c.x * cosR - c.y * sinR;
        const ry = c.x * sinR + c.y * cosR;
        return `${cx + rx},${cy - ry}`;
      }).join(' ');

      // Rotation Indicator vector
      const dx = Math.cos(rotRad);
      const dy = Math.sin(rotRad);
      const rotEndX = cx + dx * ptrLen;
      const rotEndY = cy - dy * ptrLen;

      // Arrowhead points
      const baseDist = ptrLen - 5;
      const baseX = cx + dx * baseDist;
      const baseY = cy - dy * baseDist;
      const perpX = -dy * arrowW;
      const perpY = dx * arrowW;

      return {
        id: f.id ?? `F${idx + 1}`,
        cx,
        cy,
        rotation: rot,
        cornersStr,
        rotEndX,
        rotEndY,
        rotTickLeftX: baseX + perpX,
        rotTickLeftY: baseY - perpY,
        rotTickRightX: baseX - perpX,
        rotTickRightY: baseY + perpY,
      };
    });

    return {
      viewBox: `0 0 ${Wv} ${Hv}`,
      polyPointsStr,
      screenFixtures,
    };
  });
}
