import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  collapseColinearRing,
  formatMeters,
  outwardEdgeLabels,
  parseFixtureCoordinates,
  roomRectFromEngine,
  roomRectFromSides,
  svgPathFromRings,
  type Point,
  type RoomRect,
} from './room-polygon';
import {
  centeredAutoPositions,
  positionsFromResultGrid,
  previewUserGrid,
  resolveOffset,
} from './user-grid-pack';

interface LabelSpec {
  x: number;
  y: number;
  text: string;
  transform: string;
}

interface HoverMark {
  x: number;
  y: number;
  label: string;
  aria: string;
  tipFont: number;
  tipX: number;
  tipY: number;
  tipW: number;
  tipH: number;
  tipRx: number;
  textX: number;
  textY: number;
}

@Component({
  selector: 'app-room-plan-preview',
  templateUrl: './room-plan-preview.component.html',
  styleUrl: './room-plan-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomPlanPreviewComponent {
  readonly width1 = input<number | null>(null);
  readonly length1 = input<number | null>(null);
  readonly width2 = input<number | null>(null);
  readonly length2 = input<number | null>(null);
  readonly engineLength = input<number | null>(null);
  readonly engineWidth = input<number | null>(null);
  readonly vertices = input<readonly Point[] | null>(null);
  readonly holes = input<readonly Point[][] | null>(null);

  readonly customInstall = input(false);
  readonly spacingX = input<number | null>(null);
  readonly spacingY = input<number | null>(null);
  readonly offsetStartX = input<number | null>(null);
  readonly offsetStartY = input<number | null>(null);
  readonly offsetEndMinX = input<number | null>(null);
  readonly offsetEndMinY = input<number | null>(null);

  readonly layoutNx = input<number | null>(null);
  readonly layoutNy = input<number | null>(null);
  readonly usedSpacingX = input<number | null>(null);
  readonly usedSpacingY = input<number | null>(null);
  readonly layoutMode = input<'auto' | 'user_grid' | null>(null);
  readonly fixtureCoordinates = input<unknown>(null);
  readonly chrome = input(true);

  private readonly polygon = computed<Point[] | null>(() => {
    const vertices = this.vertices();
    if (!vertices || vertices.length < 3) {
      return null;
    }
    return [...vertices];
  });

  protected readonly room = computed<RoomRect | null>(() => {
    const w1 = this.width1();
    const l1 = this.length1();
    const w2 = this.width2();
    const l2 = this.length2();
    if (w1 != null && l1 != null && w2 != null && l2 != null && w1 > 0 && l1 > 0 && w2 > 0 && l2 > 0) {
      return roomRectFromSides(w1, l1, w2, l2);
    }
    const length = this.engineLength();
    const width = this.engineWidth();
    if (length != null && width != null && length > 0 && width > 0) {
      return roomRectFromEngine(length, width);
    }
    return null;
  });

  protected readonly grid = computed(() => {
    const polygon = this.polygon();
    if (polygon) {
      const positions = parseFixtureCoordinates(this.fixtureCoordinates());
      if (positions.length === 0) {
        return null;
      }
      return {
        nx: this.layoutNx() ?? positions.length,
        ny: this.layoutNy() ?? 1,
        sx: this.usedSpacingX() ?? 0,
        sy: this.usedSpacingY() ?? 0,
        positions,
        freeAxis: null as 'x' | 'y' | null,
        error: null as string | null,
        schematic: false,
      };
    }

    const room = this.room();
    if (!room) return null;

    const nx = this.layoutNx();
    const ny = this.layoutNy();
    const usedSx = this.usedSpacingX();
    const usedSy = this.usedSpacingY();
    if (nx != null && ny != null && nx > 0 && ny > 0 && usedSx != null && usedSy != null) {
      const mode = this.layoutMode();
      const d0x = resolveOffset(this.offsetStartX());
      const d0y = resolveOffset(this.offsetStartY());
      const isUserGrid =
        mode === 'user_grid' ||
        (mode !== 'auto' && (this.offsetStartX() != null || this.offsetStartY() != null));
      const positions = isUserGrid
        ? positionsFromResultGrid(nx, ny, usedSx, usedSy, d0x, d0y)
        : centeredAutoPositions(room.lengthX, room.widthY, nx, ny, usedSx, usedSy);
      return {
        nx,
        ny,
        sx: usedSx,
        sy: usedSy,
        positions,
        freeAxis: null as 'x' | 'y' | null,
        error: null as string | null,
        schematic: false,
      };
    }

    if (!this.customInstall()) return null;

    const preview = previewUserGrid(room.lengthX, room.widthY, {
      spacingX: this.spacingX(),
      spacingY: this.spacingY(),
      offsetStartX: resolveOffset(this.offsetStartX()),
      offsetStartY: resolveOffset(this.offsetStartY()),
      offsetEndMinX: resolveOffset(this.offsetEndMinX()),
      offsetEndMinY: resolveOffset(this.offsetEndMinY()),
    });
    return {
      ...preview,
      schematic: preview.freeAxis != null && preview.error == null,
    };
  });

  protected readonly view = computed(() => {
    const polygon = this.polygon();
    if (polygon) {
      return this.planView(polygon, this.holes() ?? []);
    }

    const room = this.room();
    if (!room) return null;

    return this.planView(
      [
        { x: 0, y: 0 },
        { x: room.lengthX, y: 0 },
        { x: room.lengthX, y: room.widthY },
        { x: 0, y: room.widthY },
      ],
      [],
    );
  });

  protected readonly caption = computed(() => {
    const grid = this.grid();
    if (!grid || grid.error) return null;
    const count = `${grid.nx} × ${grid.ny}`;
    if (grid.schematic && grid.freeAxis === 'y') {
      return `${count}  ·  length (Y) auto spacing for uniformity (preview)`;
    }
    if (grid.schematic && grid.freeAxis === 'x') {
      return `${count}  ·  width (X) auto spacing for uniformity (preview)`;
    }
    if (this.layoutMode() === 'user_grid') {
      return `${count}  ·  user-specified grid`;
    }
    if (this.layoutMode() === 'auto') {
      return `${count}  ·  automatic layout`;
    }
    return count;
  });

  protected readonly ariaLabel = computed(() => {
    const polygon = this.polygon();
    if (polygon) {
      const grid = this.grid();
      const outline = `Room outline with ${polygon.length} sides`;
      if (grid && !grid.error && grid.positions.length > 0) {
        return `${outline}. ${grid.positions.length} fixtures inside the room. Hover or focus a vertex or fixture for coordinates.`;
      }
      return `${outline}. Hover or focus a vertex for coordinates.`;
    }
    const room = this.room();
    if (!room) return 'Room layout preview';
    const grid = this.grid();
    const size = `Room ${formatMeters(room.lengthX)} by ${formatMeters(room.widthY)} metres`;
    if (grid && !grid.error && grid.positions.length > 0) {
      return `${size}. ${grid.nx} by ${grid.ny} fixture grid. Hover or focus a vertex or fixture for coordinates.`;
    }
    return `${size}. Hover or focus a vertex for coordinates.`;
  });

  private planView(vertices: Point[], holes: readonly Point[][]) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of vertices) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    const spanX = Math.max(maxX - minX, 0.01);
    const spanY = Math.max(maxY - minY, 0.01);
    const fontSize = Math.max(Math.min(spanX, spanY) * 0.045, Math.max(spanX, spanY) * 0.028);
    const margin = Math.max(0.18, fontSize * 1.55);
    const flip = (y: number) => maxY - y;
    const sides = collapseColinearRing(vertices);
    const labels: LabelSpec[] = outwardEdgeLabels(sides, margin).map((label) => {
      const x = label.x;
      const y = flip(label.y);
      return {
        x,
        y,
        text: label.text,
        transform: `rotate(${edgeAngleSvg(label.from, label.to, flip)} ${x} ${y})`,
      };
    });
    const fixtureR = Math.min(spanX, spanY) * 0.022;
    const vertexR = fixtureR * 0.85;
    const hitR = Math.max(fixtureR * 1.8, fontSize * 0.35);
    const verticesMarks = sides.map((point) =>
      hoverMark(point.x, flip(point.y), point, 'Vertex', fontSize, vertexR),
    );
    const fixtures = (this.grid()?.positions ?? []).map((point) =>
      hoverMark(point.x, flip(point.y), point, 'Fixture', fontSize, fixtureR),
    );
    const drawn = [...sides.map((point) => ({ x: point.x, y: flip(point.y) })), ...labels];
    let svgMinX = Infinity;
    let svgMinY = Infinity;
    let svgMaxX = -Infinity;
    let svgMaxY = -Infinity;
    for (const point of drawn) {
      svgMinX = Math.min(svgMinX, point.x);
      svgMinY = Math.min(svgMinY, point.y);
      svgMaxX = Math.max(svgMaxX, point.x);
      svgMaxY = Math.max(svgMaxY, point.y);
    }
    const pad = Math.max(Math.max(spanX, spanY) * 0.1, fontSize * 5);
    return {
      viewBox: `${svgMinX - pad} ${svgMinY - pad} ${svgMaxX - svgMinX + pad * 2} ${svgMaxY - svgMinY + pad * 2}`,
      path: svgPathFromRings(vertices, holes, flip),
      fontSize,
      fixtureR,
      vertexR,
      hitR,
      labels,
      vertices: verticesMarks,
      fixtures,
    };
  }
}

function coordText(point: Point): string {
  return `(${formatMeters(point.x)}, ${formatMeters(point.y)})`;
}

function hoverMark(
  x: number,
  y: number,
  world: Point,
  kind: 'Vertex' | 'Fixture',
  fontSize: number,
  markR: number,
): HoverMark {
  const label = coordText(world);
  const tipFont = fontSize * 0.48;
  const padX = tipFont * 0.2;
  const padY = tipFont * 0.1;
  const tipW = label.length * tipFont * 0.52 + padX * 2;
  const tipH = tipFont * 0.92 + padY * 2;
  const gap = markR + tipFont * 0.35;
  const tipX = x - tipW / 2;
  const tipY = y - gap - tipH;
  return {
    x,
    y,
    label,
    aria: `${kind} ${label}`,
    tipFont,
    tipX,
    tipY,
    tipW,
    tipH,
    tipRx: tipH * 0.22,
    textX: x,
    textY: tipY + tipH / 2,
  };
}

function edgeAngleSvg(from: Point, to: Point, flipY: (y: number) => number): number {
  const dx = to.x - from.x;
  const dy = flipY(to.y) - flipY(from.y);
  let deg = Math.atan2(dy, dx) * (180 / Math.PI);
  if (deg > 90 || deg <= -90) {
    deg += 180;
  }
  return deg;
}
