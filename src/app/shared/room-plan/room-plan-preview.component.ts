import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatMeters, roomRectFromEngine, roomRectFromSides, type RoomRect } from './room-polygon';
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
  anchor: 'start' | 'middle' | 'end';
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
    const room = this.room();
    if (!room) return null;

    const { lengthX, widthY } = room;
    const fontSize = Math.max(Math.min(lengthX, widthY) * 0.045, Math.max(lengthX, widthY) * 0.028);
    const padX = Math.max(lengthX * 0.08, fontSize * 11);
    const padY = Math.max(widthY * 0.1, fontSize * 3.2);
    const minX = -padX;
    const minY = -padY;
    const vbW = lengthX + padX * 2;
    const vbH = widthY + padY * 2;
    const flip = (y: number) => widthY - y;
    const fixtureR = Math.min(lengthX, widthY) * 0.022;
    const originR = fixtureR * 0.7;

    const labels: LabelSpec[] = [
      {
        x: lengthX / 2,
        y: flip(0) + fontSize * 1.6,
        text: `Width 1  ${formatMeters(room.width1)} m`,
        anchor: 'middle',
      },
      {
        x: lengthX / 2,
        y: flip(widthY) - fontSize * 1.2,
        text: `Width 2  ${formatMeters(room.width2)} m`,
        anchor: 'middle',
      },
      {
        x: lengthX + fontSize * 0.6,
        y: flip(widthY / 2),
        text: `Length 1  ${formatMeters(room.length1)} m`,
        anchor: 'start',
      },
      {
        x: -fontSize * 0.6,
        y: flip(widthY / 2),
        text: `Length 2  ${formatMeters(room.length2)} m`,
        anchor: 'end',
      },
    ];

    const grid = this.grid();
    const fixtures = (grid?.positions ?? []).map((p) => ({ x: p.x, y: flip(p.y) }));

    return {
      viewBox: `${minX} ${minY} ${vbW} ${vbH}`,
      lengthX,
      widthY,
      fontSize,
      fixtureR,
      origin: { x: 0, y: flip(0), r: originR },
      labels,
      fixtures,
    };
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
    const room = this.room();
    if (!room) return 'Room layout preview';
    const grid = this.grid();
    const size = `Room ${formatMeters(room.lengthX)} by ${formatMeters(room.widthY)} metres`;
    if (grid && !grid.error && grid.positions.length > 0) {
      return `${size}. ${grid.nx} by ${grid.ny} fixture grid.`;
    }
    return size;
  });
}
