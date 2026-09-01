import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  bboxFromPoints,
  collectRoomVertices,
  hasParsedDimensions,
  hashIndex,
  isApproximateFootprint,
  largestRoom,
  layoutBounds,
  mappedPolygonPath,
  netArea as roomNetArea,
  openingMark,
  padBbox,
  roomPolygon,
  snapToVertices,
  unmapY,
  wallSegment,
} from '../../cad-geometry';
import { CadFitMode, CadViewerStore } from '../../cad-viewer.store';
import { BoundingBox } from '../../models/bounding-box.model';
import { CadObject } from '../../models/cad-object.model';
import { Layout } from '../../models/layout.model';
import { Opening } from '../../models/opening.model';
import { Point } from '../../models/point.model';
import { Room } from '../../models/room.model';
import { Segment } from '../../models/segment.model';
import { Wall } from '../../models/wall.model';

const ROOM_FILLS = [
  'rgba(255,255,255,0.07)',
  'rgba(255,255,255,0.10)',
  'rgba(255,255,255,0.13)',
  'rgba(255,255,255,0.16)',
  'rgba(184,184,184,0.10)',
];

interface CadCamera {
  worldMaxY: number;
  minX: number;
  minY: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-cad-plan',
  imports: [DecimalPipe],
  templateUrl: './cad-plan.component.html',
  styleUrl: './cad-plan.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block h-full',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class CadPlanComponent {
  protected readonly store = inject(CadViewerStore);

  private readonly svg = viewChild<SVGSVGElement>('planSvg');

  private readonly panOrigin = signal<{
    point: Point;
    camera: CadCamera;
    inv: DOMMatrix;
  } | null>(null);
  private didPan = false;
  private fitCamera: CadCamera | null = null;

  protected readonly camera = signal<CadCamera | null>(null);
  protected readonly snapHint = signal<Point | null>(null);

  protected readonly layout = computed(() => this.store.currentLayout());

  protected readonly viewBox = computed(() => {
    const cam = this.camera();
    if (!cam) {
      return '0 0 1 1';
    }
    return `${cam.minX} ${cam.minY} ${cam.width} ${cam.height}`;
  });

  protected readonly markerSize = computed(() => {
    const cam = this.camera();
    if (!cam) {
      return 0.2;
    }
    return Math.min(cam.width, cam.height) * 0.012;
  });

  protected readonly labelSize = computed(() => {
    const cam = this.camera();
    if (!cam) {
      return 0.4;
    }
    return Math.min(cam.width, cam.height) * 0.022;
  });

  protected readonly dash = computed(() => {
    const cam = this.camera();
    if (!cam) {
      return '0.2 0.15';
    }
    const on = Math.min(cam.width, cam.height) * 0.012;
    return `${on} ${on * 0.7}`;
  });

  protected readonly vertices = computed(() => {
    const layout = this.layout();
    return layout ? collectRoomVertices(layout) : [];
  });

  protected readonly overlayDividers = computed((): Segment[] => {
    const drafts = this.store.draftDividers();
    if (drafts.length > 0) {
      return drafts;
    }
    return (this.layout()?.virtual_dividers ?? [])
      .filter((divider) => divider.active)
      .map((divider) => ({ start: divider.start, end: divider.end }));
  });

  protected readonly selectedPhysicalId = computed(() => {
    const id = this.store.selectedRoomId();
    const room = this.layout()?.rooms.find((item) => item.id === id);
    return room?.physical_room_id ?? null;
  });

  constructor() {
    effect((onCleanup) => {
      const el = unwrapElement(this.svg());
      if (!el) {
        return;
      }
      const handler = (event: WheelEvent) => this.onWheel(event);
      el.addEventListener('wheel', handler, { passive: false });
      onCleanup(() => el.removeEventListener('wheel', handler));
    });

    effect(() => {
      const fit = this.store.fitMode();
      this.store.jobId();
      const layout = untracked(() => this.store.currentLayout());
      const next = this.buildFitCamera(layout, fit);
      this.fitCamera = next;
      this.camera.set(next);
    });
  }

  ty(y: number): number {
    const cam = this.camera();
    return cam ? cam.worldMaxY - y : y;
  }

  boxTop(bbox: BoundingBox): number {
    return this.ty(bbox.max_y);
  }

  boxHeight(bbox: BoundingBox): number {
    return Math.max(bbox.max_y - bbox.min_y, 0);
  }

  roomFill(room: Room): string {
    if (this.store.selectedRoomId() === room.id) {
      return 'rgba(235,27,38,0.22)';
    }
    if (
      this.selectedPhysicalId() &&
      room.physical_room_id === this.selectedPhysicalId() &&
      room.kind === 'virtual'
    ) {
      return 'rgba(235,27,38,0.10)';
    }
    if (room.kind === 'virtual') {
      return 'rgba(235,27,38,0.08)';
    }
    return ROOM_FILLS[hashIndex(room.id, ROOM_FILLS.length)];
  }

  roomPath(room: Room): string {
    const cam = this.camera();
    return mappedPolygonPath(roomPolygon(room), cam?.worldMaxY ?? 0);
  }

  netArea(room: Room): number {
    return roomNetArea(room);
  }

  sizeLabel(room: Room): string | null {
    const dimensions = room.dimensions;
    if (!dimensions) {
      return null;
    }
    const length = dimensions.length_m.toFixed(2);
    const width = dimensions.width_m.toFixed(2);
    const prefix = isApproximateFootprint(room) ? '≈ ' : '';
    return `${prefix}${length} × ${width} m`;
  }

  sizeFromDrawing(room: Room): boolean {
    return hasParsedDimensions(room);
  }

  dimensionTransform(room: Room): string | null {
    const dimensions = room.dimensions;
    if (!dimensions || !room.center) {
      return null;
    }
    return `rotate(${-dimensions.orientation_deg} ${room.center.x} ${this.ty(room.center.y)})`;
  }

  dimensionBox(room: Room): { x: number; y: number; width: number; height: number } | null {
    const dimensions = room.dimensions;
    if (!dimensions || !room.center) {
      return null;
    }
    return {
      x: room.center.x - dimensions.length_m / 2,
      y: this.ty(room.center.y) - dimensions.width_m / 2,
      width: dimensions.length_m,
      height: dimensions.width_m,
    };
  }

  wallLine(wall: Wall): Segment | null {
    return wallSegment(wall);
  }

  openingLine(opening: Opening): Segment | null {
    return openingMark(opening);
  }

  objectRotate(object: CadObject): string {
    const deg = -(object.rotation_deg ?? 0);
    return `rotate(${deg} ${object.position.x} ${this.ty(object.position.y)})`;
  }

  contentRooms(plan: Layout): Room[] {
    return plan.rooms.filter((room) => room.selectable !== false);
  }

  polyPath(polygon: { vertices: Point[] } | null | undefined): string {
    const cam = this.camera();
    return mappedPolygonPath(polygon, cam?.worldMaxY ?? 0);
  }

  textSize(heightM?: number): number {
    const base = this.labelSize();
    if (!heightM || heightM <= 0) {
      return base;
    }
    return Math.min(heightM, base * 1.4);
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const svg = this.svgEl();
    svg?.setPointerCapture(event.pointerId);

    if (this.store.drawMode() === 'draw') {
      const world = this.clientToWorld(event);
      if (!world) {
        return;
      }
      const snapped = snapToVertices(world, this.vertices());
      const start = this.store.pendingStart();
      if (!start) {
        this.store.setPendingStart(snapped);
        this.store.setPreviewEnd(snapped);
        this.snapHint.set(snapped);
        console.debug('CAD world point (m)', snapped);
        return;
      }
      this.store.addDraftDivider(start, snapped);
      this.snapHint.set(null);
      console.debug('CAD world point (m)', snapped);
      return;
    }

    const cam = this.camera();
    const inv = this.inverseCtm();
    const point = this.clientToSvg(event, inv);
    if (!cam || !inv || !point) {
      return;
    }
    this.didPan = false;
    this.panOrigin.set({ point, camera: cam, inv });
  }

  onPointerMove(event: PointerEvent): void {
    if (this.store.drawMode() === 'draw') {
      const world = this.clientToWorld(event);
      if (!world) {
        return;
      }
      const snapped = snapToVertices(world, this.vertices());
      this.snapHint.set(snapped);
      if (this.store.pendingStart()) {
        this.store.setPreviewEnd(snapped);
      }
      return;
    }

    const origin = this.panOrigin();
    if (!origin) {
      return;
    }
    const now = this.clientToSvg(event, origin.inv);
    if (!now) {
      return;
    }
    const dx = now.x - origin.point.x;
    const dy = now.y - origin.point.y;
    if (Math.hypot(dx, dy) > origin.camera.width * 0.002) {
      this.didPan = true;
    }
    this.camera.set({
      ...origin.camera,
      minX: origin.camera.minX - dx,
      minY: origin.camera.minY - dy,
    });
  }

  onPointerUp(event: PointerEvent): void {
    const svg = this.svgEl();
    if (svg?.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
    this.panOrigin.set(null);
  }

  onRoomActivate(roomId: string): void {
    if (this.store.drawMode() !== 'pan' || this.didPan) {
      return;
    }
    this.store.selectRoom(this.store.selectedRoomId() === roomId ? null : roomId);
  }

  onEscape(): void {
    this.store.clearPreview();
    this.snapHint.set(null);
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const cam = this.camera();
    const fit = this.fitCamera;
    const inv = this.inverseCtm();
    const cursor = this.clientToSvg(event, inv);
    if (!cam || !fit || !cursor) {
      return;
    }

    const factor = Math.min(1.25, Math.max(0.8, Math.exp(event.deltaY * 0.0015)));
    let width = cam.width * factor;
    const minW = fit.width * 0.02;
    const maxW = fit.width * 8;
    width = Math.min(maxW, Math.max(minW, width));
    const height = (width / cam.width) * cam.height;
    const fx = (cursor.x - cam.minX) / cam.width;
    const fy = (cursor.y - cam.minY) / cam.height;
    this.camera.set({
      ...cam,
      minX: cursor.x - fx * width,
      minY: cursor.y - fy * height,
      width,
      height,
    });
  }

  private buildFitCamera(layout: Layout | null, fit: CadFitMode): CadCamera | null {
    if (!layout) {
      return null;
    }
    let bounds: BoundingBox | null = null;
    if (fit === 'largest') {
      const room = largestRoom(layout);
      bounds = room
        ? (room.bbox ?? bboxFromPoints(roomPolygon(room).vertices))
        : null;
    }
    bounds ??= layoutBounds(layout);
    if (!bounds) {
      return null;
    }
    const padded = padBbox(bounds, 0.08);
    const width = Math.max(padded.max_x - padded.min_x, 1e-6);
    const height = Math.max(padded.max_y - padded.min_y, 1e-6);
    return {
      worldMaxY: padded.max_y,
      minX: padded.min_x,
      minY: 0,
      width,
      height,
    };
  }

  private clientToWorld(event: { clientX: number; clientY: number }): Point | null {
    const cam = this.camera();
    const svg = this.clientToSvg(event, this.inverseCtm());
    if (!cam || !svg) {
      return null;
    }
    return { x: svg.x, y: unmapY(svg.y, cam.worldMaxY) };
  }

  private clientToSvg(
    event: { clientX: number; clientY: number },
    inv: DOMMatrix | null,
  ): Point | null {
    if (!inv) {
      return null;
    }
    const mapped = new DOMPoint(event.clientX, event.clientY).matrixTransform(inv);
    return { x: mapped.x, y: mapped.y };
  }

  private inverseCtm(): DOMMatrix | null {
    const ctm = this.svgEl()?.getScreenCTM();
    return ctm ? ctm.inverse() : null;
  }

  private svgEl(): SVGSVGElement | undefined {
    return unwrapElement(this.svg());
  }
}

function unwrapElement<T extends Element>(value: T | ElementRef<T> | undefined): T | undefined {
  if (!value) {
    return undefined;
  }
  return value instanceof ElementRef ? value.nativeElement : value;
}
