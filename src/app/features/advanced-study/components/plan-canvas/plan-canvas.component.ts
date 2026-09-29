import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { FixtureDto, PatchDto } from '../../../../core/calculate/dtos/calculate-response.dto';
import { luxFillWithPalette } from '../../../../shared/room-plan/heatmap-render';
import { AdvancedStudyStore } from '../../stores/advanced-study.store';

interface ScreenPatch {
  left: number;
  top: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  fill: string;
  lux: number;
  luxDisplay: string;
  fontSize: number;
}

interface ScreenFixture {
  id: string;
  cx: number;
  cy: number;
  cornersStr: string;
  hasAim: boolean;
  aimEndX: number;
  aimEndY: number;
  isSelected: boolean;
}

@Component({
  selector: 'app-plan-canvas',
  imports: [DecimalPipe],
  template: `

    <div
      #canvasContainer
      class="relative w-full h-[580px] bg-black rounded-xl border border-border overflow-hidden select-none"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp()"
      (pointerleave)="onPointerUp()"
    >
      <!-- Top Canvas HUD -->
      <div class="absolute top-3 left-3 z-10 flex items-center gap-3 bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border">
        <span class="font-mono text-xs text-white">
          {{ store.roomLength() }}m × {{ store.roomWidth() }}m
        </span>
        <span class="text-border">|</span>
        <span class="font-mono text-xs text-muted uppercase">
          Layer: <strong class="text-white">{{ store.activeLayer() }}</strong>
        </span>
        @if (hoverLux() !== null) {
          <span class="text-border">|</span>
          <span class="font-mono text-xs text-primary font-medium">
            {{ hoverLux() | number: '1.0-0' }} lx
          </span>
        }
      </div>

      <!-- Top Right Controls -->
      <div class="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          type="button"
          class="h-8 px-3 rounded-lg bg-primary text-white font-mono text-xs font-semibold hover:bg-primary-dark transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          (click)="store.addFixtureAt()"
          title="Add a new luminaire into the room (can be freely moved, rotated, and customized)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>ADD FIXTURE</span>
        </button>
        <button
          type="button"
          class="h-8 px-2.5 rounded-lg border font-mono text-xs transition-colors cursor-pointer flex items-center gap-1.5"
          [class]="store.showValueChart() ? 'bg-white text-black border-white font-semibold shadow-xs' : 'bg-surface/90 border-border text-muted hover:text-white hover:border-[#3A3A3A]'"
          (click)="store.toggleValueChart()"
          [title]="store.showValueChart() ? 'Hide numerical lux value chart' : 'Display numerical illuminance lux value chart overlay on calculation grid'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
          </svg>
          <span>{{ store.showValueChart() ? '🔢 VALUES: ON' : '🔢 VALUES: OFF' }}</span>
        </button>
        <button
          type="button"
          class="h-8 px-2.5 rounded-lg bg-surface/90 border border-border font-mono text-xs text-muted hover:text-white hover:border-[#3A3A3A] transition-colors cursor-pointer"
          (click)="store.togglePalette()"
          title="Toggle heatmap palette between false-color photometric gradient and monochrome architectural palette"
        >
          {{ store.activePalette() === 'false-color' ? '🎨 FALSE-COLOR' : '🏁 MONOCHROME' }}
        </button>
      </div>

      <!-- SVG Viewport -->
      <svg
        #svgElement
        class="w-full h-full cursor-crosshair"
        (click)="onCanvasClick($event)"
      >
        <!-- Room Background & Perimeter -->
        @if (roomPolygonPath()) {
          <path
            [attr.d]="roomPolygonPath()"
            fill="#090909"
            stroke="#2B2B2B"
            stroke-width="2"
          />
        }

        <!-- Floor Heatmap Cells -->
        <g class="patches-layer">
          @for (patch of screenPatches(); track $index) {
            <rect
              [attr.x]="patch.left"
              [attr.y]="patch.top"
              [attr.width]="patch.width"
              [attr.height]="patch.height"
              [attr.fill]="patch.fill"
              [attr.stroke]="store.showValueChart() ? 'rgba(255,255,255,0.15)' : 'transparent'"
              [attr.stroke-width]="store.showValueChart() ? 0.75 : 0"
              (pointerenter)="hoverLux.set(patch.lux)"
              (pointerleave)="hoverLux.set(null)"
            />
          }
        </g>

        <!-- Value Chart Numerical Lux Overlay -->
        @if (store.showValueChart()) {
          <g class="value-chart-layer pointer-events-none select-none">
            @for (patch of screenPatches(); track $index) {
              @if (patch.width >= 16) {
                <text
                  [attr.x]="patch.cx"
                  [attr.y]="patch.cy"
                  text-anchor="middle"
                  dominant-baseline="central"
                  class="font-mono font-medium"
                  [style.font-size.px]="patch.fontSize"
                  fill="#FFFFFF"
                  stroke="#000000"
                  stroke-width="2"
                  paint-order="stroke fill"
                  stroke-linejoin="round"
                >
                  {{ patch.luxDisplay }}
                </text>
              }
            }
          </g>
        }

        <!-- Room Outline over patches -->
        @if (roomPolygonPath()) {
          <path
            [attr.d]="roomPolygonPath()"
            fill="none"
            stroke="#ffffff"
            stroke-width="1.5"
            stroke-opacity="0.6"
          />
        }

        <!-- Fixtures Layer -->
        <g class="fixtures-layer">
          @for (f of screenFixtures(); track f.id) {
            <g
              class="cursor-grab active:cursor-grabbing transition-transform"
              (pointerdown)="onFixturePointerDown(f.id, $event)"
              (click)="$event.stopPropagation(); store.selectFixture(f.id)"
              [attr.title]="'Luminaire ' + f.id + ' — Click to inspect or drag to position'"
            >
              <!-- Luminous opening polygon -->
              <polygon
                [attr.points]="f.cornersStr"
                [attr.fill]="f.isSelected ? '#EB1B26' : '#F0A202'"
                [attr.stroke]="f.isSelected ? '#FFFFFF' : '#000000'"
                stroke-width="1.5"
                [attr.fill-opacity]="f.isSelected ? 0.9 : 0.75"
              />

              <!-- Center crosshair / dot -->
              <circle
                [attr.cx]="f.cx"
                [attr.cy]="f.cy"
                r="3"
                fill="#FFFFFF"
                stroke="#000000"
                stroke-width="1"
              />

              <!-- Aim direction arrow if tilted -->
              @if (f.hasAim) {
                <line
                  [attr.x1]="f.cx"
                  [attr.y1]="f.cy"
                  [attr.x2]="f.aimEndX"
                  [attr.y2]="f.aimEndY"
                  stroke="#EB1B26"
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
                <circle
                  [attr.cx]="f.aimEndX"
                  [attr.cy]="f.aimEndY"
                  r="3.5"
                  fill="#EB1B26"
                />
              }

              <!-- Fixture Identifier Label -->
              <text
                [attr.x]="f.cx"
                [attr.y]="f.cy - 12"
                text-anchor="middle"
                class="font-mono text-[10px] fill-white pointer-events-none select-none"
                style="text-shadow: 0 1px 3px rgba(0,0,0,0.8)"
              >
                {{ f.id }}
              </text>
            </g>
          }
        </g>
      </svg>

      <!-- Bottom Lux Legend -->
      <div class="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between bg-surface/90 backdrop-blur-md px-4 py-2 rounded-lg border border-border">
        <div class="flex items-center gap-2">
          <span class="font-mono text-[11px] text-muted uppercase">Min:</span>
          <span class="font-mono text-xs text-white font-semibold">{{ minLuxDisplay() }} lx</span>
        </div>

        <div class="flex-1 max-w-xs mx-4">
          <div
            class="h-2.5 rounded-full border border-border"
            [style.background]="legendGradientCss()"
          ></div>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5">
            <span class="font-mono text-[11px] text-muted uppercase">Avg:</span>
            <span class="font-mono text-xs text-primary font-bold">{{ avgLuxDisplay() }} lx</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="font-mono text-[11px] text-muted uppercase">Max:</span>
            <span class="font-mono text-xs text-white font-semibold">{{ maxLuxDisplay() }} lx</span>
          </div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCanvasComponent {
  protected readonly store = inject(AdvancedStudyStore);
  protected readonly hoverLux = signal<number | null>(null);

  private readonly canvasContainer = viewChild<ElementRef<HTMLDivElement>>('canvasContainer');
  private readonly svgElement = viewChild<ElementRef<SVGSVGElement>>('svgElement');

  private draggingFixtureId: string | null = null;

  // Viewport dimensions
  private readonly viewportWidth = signal(800);
  private readonly viewportHeight = signal(580);

  // Section 7 Bounding Box & Scale Calculations
  protected readonly mapping = computed(() => {
    const poly = this.store.polygon();
    const Wv = this.viewportWidth();
    const Hv = this.viewportHeight();
    const margin = 40;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of poly) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const Wbox = Math.max(0.01, maxX - minX);
    const Hbox = Math.max(0.01, maxY - minY);

    const S = Math.min((Wv - 2 * margin) / Wbox, (Hv - 2 * margin) / Hbox);
    const Ox = (Wv - Wbox * S) / 2 - minX * S;
    const Oy = (Hv - Hbox * S) / 2 + maxY * S;

    return { S, Ox, Oy, minX, maxX, minY, maxY };
  });

  // World to screen
  worldToScreen(x: number, y: number): { sx: number; sy: number } {
    const { S, Ox, Oy } = this.mapping();
    return {
      sx: x * S + Ox,
      sy: Oy - y * S,
    };
  }

  // Screen to world
  screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    const { S, Ox, Oy } = this.mapping();
    return {
      wx: (sx - Ox) / S,
      wy: (Oy - sy) / S,
    };
  }

  protected readonly roomPolygonPath = computed(() => {
    const poly = this.store.polygon();
    if (poly.length < 3) return '';
    const points = poly.map((p) => {
      const { sx, sy } = this.worldToScreen(p.x, p.y);
      return `${sx},${sy}`;
    });
    return `M ${points.join(' L ')} Z`;
  });

  // Active matrix computation
  protected readonly activeMatrixValues = computed<number[]>(() => {
    const res = this.store.lastResult();
    if (!res) return [];
    const layer = this.store.activeLayer();
    const filter = this.store.activeFixtureFilter();
    const vResult = this.store.currentVariantResult();

    const directMatrices = vResult?.directFloorMatrices ?? res.directFloorMatrices ?? {};
    const indirectMatrices = vResult?.indirectFloorMatrices ?? res.indirectFloorMatrices ?? {};

    if (layer === 'total') {
      return vResult ? vResult.totalFloorIlluminance.values : res.totalFloorIlluminance.values;
    }

    if (layer === 'direct') {
      if (filter && directMatrices[filter]) {
        return directMatrices[filter].values;
      }
      // Sum all direct fixture matrices
      const count = res.floorPatches.length;
      const sum = new Array(count).fill(0);
      for (const m of Object.values(directMatrices)) {
        for (let i = 0; i < count; i++) {
          sum[i] += m.values[i] ?? 0;
        }
      }
      return sum;
    }

    // Indirect reflection
    const count = res.floorPatches.length;
    const sum = new Array(count).fill(0);
    for (const m of Object.values(indirectMatrices)) {
      for (let i = 0; i < count; i++) {
        sum[i] += m.values[i] ?? 0;
      }
    }
    return sum;
  });

  protected readonly luxBounds = computed(() => {
    const values = this.activeMatrixValues();
    if (values.length === 0) return { min: 0, max: 500, avg: 250 };
    let min = Infinity;
    let max = -Infinity;
    let total = 0;
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
      total += v;
    }
    return {
      min: Number.isFinite(min) ? Math.round(min) : 0,
      max: Number.isFinite(max) ? Math.round(max) : 500,
      avg: values.length ? Math.round(total / values.length) : 0,
    };
  });

  protected readonly minLuxDisplay = computed(() => this.luxBounds().min);
  protected readonly maxLuxDisplay = computed(() => this.luxBounds().max);
  protected readonly avgLuxDisplay = computed(() => this.luxBounds().avg);

  protected readonly legendGradientCss = computed(() => {
    if (this.store.activePalette() === 'brand') {
      return 'linear-gradient(to right, #111111, #2B2B2B, #B8B8B8, #F4B740, #FFFFFF)';
    }
    return 'linear-gradient(to right, #0b1c33, #1f6feb, #f0a202, #fff7cc)';
  });

  protected readonly screenPatches = computed<ScreenPatch[]>(() => {
    const res = this.store.lastResult();
    if (!res || !res.floorPatches) return [];
    const values = this.activeMatrixValues();
    const { S, Ox, Oy } = this.mapping();
    const { min, max } = this.luxBounds();
    const palette = this.store.activePalette();

    return res.floorPatches.map((patch: PatchDto, i: number) => {
      const d = patch.size;
      const left = (patch.center.x - d / 2) * S + Ox;
      const top = Oy - (patch.center.y + d / 2) * S;
      const cx = patch.center.x * S + Ox;
      const cy = Oy - patch.center.y * S;
      const width = Math.max(1.5, d * S);
      const height = Math.max(1.5, d * S);
      const lux = values[i] ?? 0;
      const fill = luxFillWithPalette(lux, min, max, palette);
      const luxDisplay = Math.round(lux).toString();
      const fontSize = Math.max(7, Math.min(11, Math.round(width * 0.32)));

      return { left, top, width, height, cx, cy, fill, lux, luxDisplay, fontSize };
    });
  });

  protected readonly screenFixtures = computed<ScreenFixture[]>(() => {
    const list = this.store.freeFixtures();
    const resFixtures = this.store.activePlacedFixtures();
    const selectedId = this.store.selectedFixtureId();
    const { S, Ox, Oy } = this.mapping();

    return list.map((f, i) => {
      const { sx: cx, sy: cy } = this.worldToScreen(f.x, f.y);

      // Look up detailed corners if calculated, else construct a default 0.6x0.6m opening
      const dto = resFixtures.find((rf) => rf.id === f.id) ?? resFixtures[i];
      let cornersStr = '';
      if (dto && dto.corners && dto.corners.length >= 4) {
        cornersStr = dto.corners
          .map((c) => {
            const { sx, sy } = this.worldToScreen(c.x, c.y);
            return `${sx},${sy}`;
          })
          .join(' ');
      } else {
        const half = 0.3 * S;
        cornersStr = `${cx - half},${cy - half} ${cx + half},${cy - half} ${cx + half},${cy + half} ${cx - half},${cy + half}`;
      }

      // Aim direction
      const tilt = f.tiltAngle ?? 0;
      const hasAim = tilt > 0;
      const aimLen = 24;
      let dx = Math.cos((f.rotation ?? 0) * (Math.PI / 180));
      let dy = Math.sin((f.rotation ?? 0) * (Math.PI / 180));
      if (f.aimDirection && (f.aimDirection.x !== 0 || f.aimDirection.y !== 0)) {
        const mag = Math.hypot(f.aimDirection.x, f.aimDirection.y);
        if (mag > 0.001) {
          dx = f.aimDirection.x / mag;
          dy = f.aimDirection.y / mag;
        }
      }
      const aimEndX = cx + dx * aimLen;
      const aimEndY = cy - dy * aimLen;

      return {
        id: f.id ?? `F${i + 1}`,
        cx,
        cy,
        cornersStr,
        hasAim,
        aimEndX,
        aimEndY,
        isSelected: f.id === selectedId,
      };
    });
  });

  onFixturePointerDown(id: string, event: PointerEvent) {
    event.stopPropagation();
    this.draggingFixtureId = id;
    this.store.selectFixture(id);
    (event.target as HTMLElement)?.setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent) {
    if (!this.draggingFixtureId) return;
    const container = this.canvasContainer()?.nativeElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    const { wx, wy } = this.screenToWorld(sx, sy);
    this.store.moveFixture(this.draggingFixtureId, wx, wy);
  }

  onPointerUp() {
    this.draggingFixtureId = null;
  }

  onCanvasClick(event: MouseEvent) {
    const container = this.canvasContainer()?.nativeElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    // Deselect fixture
    this.store.selectFixture(null);
  }
}
