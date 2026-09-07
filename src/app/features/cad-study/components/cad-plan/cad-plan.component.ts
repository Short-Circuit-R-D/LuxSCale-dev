import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { bboxFromPoints, largestRoom, layoutBounds, roomPolygon } from '../../cad-geometry';
import { CadFitMode, CadViewerStore } from '../../cad-viewer.store';
import { BoundingBox } from '../../models/bounding-box.model';
import { Layout } from '../../models/layout.model';
import { Point } from '../../models/point.model';
import {
  CadCamera,
  drawCadScene,
  fitCamera,
  hitTestFaces,
  hitTestRooms,
  panCamera,
  prepareCadScene,
  recenterCamera,
  screenToWorld,
  zoomCamera,
} from './cad-plan.renderer';

const MAX_DPR = 2;
const ZOOM_IN = 1.12;
const ZOOM_OUT = 1 / 1.12;

@Component({
  selector: 'app-cad-plan',
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
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  private readonly canvasRef = viewChild<HTMLCanvasElement>('planCanvas');

  private panOrigin: { x: number; y: number; camera: CadCamera } | null = null;
  private fitBounds: BoundingBox | null = null;
  private fittedJobId: string | null = null;
  private fittedMode: CadFitMode | null = null;
  private userAdjusted = false;
  private ctx: CanvasRenderingContext2D | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private drawFrame = 0;
  private hoverFrame = 0;
  private pendingHover: { clientX: number; clientY: number } | null = null;

  protected readonly camera = signal<CadCamera | null>(null);
  protected readonly hoverFaceId = signal<string | null>(null);
  protected readonly hoverRoomId = signal<string | null>(null);
  protected readonly draggingCanvas = signal(false);

  protected readonly layout = computed(() => this.store.currentLayout());

  protected readonly scene = computed(() =>
    prepareCadScene({
      layout: this.layout(),
      faces: this.store.faces(),
      layers: this.store.layers(),
      physicalRoomsOnly: this.store.physicalRoomsOnly(),
      showAllFaces: this.store.showAllFaces(),
      tool: this.store.tool(),
    }),
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.drawFrame) {
        cancelAnimationFrame(this.drawFrame);
      }
      if (this.hoverFrame) {
        cancelAnimationFrame(this.hoverFrame);
      }
    });

    effect((onCleanup) => {
      const canvas = this.canvasEl();
      if (!canvas) {
        this.ctx = null;
        return;
      }
      this.ctx =
        canvas.getContext('2d', { alpha: false, desynchronized: true }) ??
        canvas.getContext('2d', { alpha: false });
      this.syncCanvasSize(canvas);
      const onWheel = (event: WheelEvent) => this.onWheel(event);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      const observer = new ResizeObserver(() => {
        this.syncCanvasSize(canvas);
        this.scheduleDraw();
      });
      observer.observe(this.host.nativeElement);
      observer.observe(canvas);
      const frame = requestAnimationFrame(() => {
        this.syncCanvasSize(canvas);
        this.scheduleDraw();
      });
      this.scheduleDraw();
      onCleanup(() => {
        cancelAnimationFrame(frame);
        canvas.removeEventListener('wheel', onWheel);
        observer.disconnect();
      });
    });

    effect(() => {
      const fit = this.store.fitMode();
      const jobId = this.store.jobId();
      const layout = this.store.currentLayout();
      if (!layout || !jobId) {
        this.fittedJobId = null;
        this.fittedMode = null;
        this.fitBounds = null;
        this.userAdjusted = false;
        this.camera.set(null);
        return;
      }
      const shouldRefit =
        this.fittedJobId !== jobId || this.fittedMode !== fit || untracked(() => this.camera()) === null;
      if (!shouldRefit) {
        return;
      }
      this.fittedJobId = jobId;
      this.fittedMode = fit;
      this.userAdjusted = false;
      this.fitBounds = this.boundsForFit(layout, fit);
      this.applyFit();
    });

    effect(() => {
      this.scene();
      this.camera();
      this.store.selectedRoomIds();
      this.hoverFaceId();
      this.hoverRoomId();
      this.store.pendingStart();
      this.store.previewEnd();
      this.store.tool();
      this.scheduleDraw();
    });
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const canvas = this.canvasEl();
    canvas?.setPointerCapture(event.pointerId);
    this.hoverFaceId.set(null);
    this.hoverRoomId.set(null);

    const tool = this.store.tool();
    if (tool === 'split') {
      const world = this.clientToWorld(event);
      if (!world) {
        return;
      }
      const start = this.store.pendingStart();
      if (!start) {
        this.store.setPendingStart(world);
        this.store.setPreviewEnd(world);
        return;
      }
      this.store.splitWithDivider(start, world);
      return;
    }

    if (tool === 'select' || tool === 'restore') {
      this.activateAt(event);
      return;
    }

    const camera = this.camera();
    if (!camera) {
      return;
    }
    this.panOrigin = { x: event.clientX, y: event.clientY, camera };
  }

  onPointerMove(event: PointerEvent): void {
    const tool = this.store.tool();
    if (tool === 'split') {
      const world = this.clientToWorld(event);
      if (!world) {
        return;
      }
      if (this.store.pendingStart()) {
        this.store.setPreviewEnd(world);
      }
      return;
    }

    const origin = this.panOrigin;
    if (origin && tool === 'pan') {
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (Math.hypot(dx, dy) > 2) {
        this.userAdjusted = true;
        this.draggingCanvas.set(true);
      }
      this.camera.set(panCamera(origin.camera, dx, dy));
      return;
    }

    this.queueHover(event);
  }

  onPointerUp(event: PointerEvent): void {
    const canvas = this.canvasEl();
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    this.panOrigin = null;
    this.draggingCanvas.set(false);
  }

  onPointerLeave(): void {
    if (!this.panOrigin) {
      this.hoverFaceId.set(null);
      this.hoverRoomId.set(null);
    }
  }

  onEscape(): void {
    if (this.store.resetConfirmOpen()) {
      return;
    }
    this.store.clearPreview();
    if (this.store.tool() === 'select') {
      this.store.selectRoom(null);
      this.store.selectFace(null);
    }
  }

  private activateAt(event: PointerEvent): void {
    const world = this.clientToWorld(event);
    const scene = this.scene();
    if (!world || !scene) {
      return;
    }
    const tool = this.store.tool();
    if (tool === 'restore') {
      const faceId = hitTestFaces(scene, world);
      if (faceId) {
        this.store.restoreFace(faceId);
      }
      return;
    }
    if (tool !== 'select') {
      return;
    }
    const roomId = hitTestRooms(scene, world);
    if (event.shiftKey && roomId) {
      this.store.selectRoom(roomId, { additive: true });
      return;
    }
    this.store.selectRoom(roomId);
  }

  private queueHover(event: PointerEvent): void {
    this.pendingHover = { clientX: event.clientX, clientY: event.clientY };
    if (this.hoverFrame) {
      return;
    }
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      const pending = this.pendingHover;
      this.pendingHover = null;
      if (!pending || this.panOrigin) {
        return;
      }
      const world = this.clientToWorld(pending);
      const scene = this.scene();
      if (!world || !scene) {
        this.hoverFaceId.set(null);
        this.hoverRoomId.set(null);
        return;
      }
      if (this.store.tool() === 'restore') {
        this.hoverFaceId.set(hitTestFaces(scene, world));
        this.hoverRoomId.set(null);
        return;
      }
      const roomId = hitTestRooms(scene, world);
      this.hoverRoomId.set(roomId);
      this.hoverFaceId.set(roomId ? null : hitTestFaces(scene, world));
    });
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const camera = this.camera();
    const point = this.clientToCanvas(event);
    if (!camera || !point) {
      return;
    }
    this.userAdjusted = true;
    const factor = event.deltaY < 0 ? ZOOM_IN : ZOOM_OUT;
    this.camera.set(zoomCamera(camera, point.x, point.y, factor));
  }

  private boundsForFit(layout: Layout, fit: CadFitMode): BoundingBox | null {
    if (fit === 'largest') {
      const room = largestRoom(layout);
      const bounds = room ? (room.bbox ?? bboxFromPoints(roomPolygon(room).vertices)) : null;
      if (bounds) {
        return bounds;
      }
    }
    return layoutBounds(layout);
  }

  private applyFit(): void {
    const bounds = this.fitBounds;
    if (!bounds || this.cssWidth <= 0 || this.cssHeight <= 0) {
      return;
    }
    this.camera.set(fitCamera(bounds, this.cssWidth, this.cssHeight));
  }

  private clientToWorld(event: { clientX: number; clientY: number }): Point | null {
    const camera = this.camera();
    const point = this.clientToCanvas(event);
    if (!camera || !point || camera.scale <= 0) {
      return null;
    }
    return screenToWorld(point.x, point.y, camera);
  }

  private clientToCanvas(event: { clientX: number; clientY: number }): Point | null {
    const canvas = this.canvasEl();
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private scheduleDraw(): void {
    if (this.drawFrame) {
      return;
    }
    this.drawFrame = requestAnimationFrame(() => {
      this.drawFrame = 0;
      this.paint();
    });
  }

  private paint(): void {
    const ctx = this.ctx;
    const camera = this.camera();
    const scene = this.scene();
    if (!ctx || !camera || !scene) {
      return;
    }
    drawCadScene({
      ctx,
      cssWidth: this.cssWidth,
      cssHeight: this.cssHeight,
      dpr: this.dpr,
      camera,
      scene,
      selectedRoomIds: this.store.selectedRoomIds(),
      hoverFaceId: this.hoverFaceId(),
      hoverRoomId: this.hoverRoomId(),
      pendingStart: this.store.pendingStart(),
      previewEnd: this.store.previewEnd(),
    });
  }

  private syncCanvasSize(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const prevWidth = this.cssWidth;
    const prevHeight = this.cssHeight;
    const nextWidth = rect.width;
    const nextHeight = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = Math.max(1, Math.round(nextWidth * this.dpr));
    const height = Math.max(1, Math.round(nextHeight * this.dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const sizeChanged = prevWidth !== nextWidth || prevHeight !== nextHeight;
    this.cssWidth = nextWidth;
    this.cssHeight = nextHeight;

    if (!this.fitBounds || nextWidth <= 0 || nextHeight <= 0) {
      return;
    }
    const camera = this.camera();
    if (!camera || !this.userAdjusted) {
      if (!camera || sizeChanged) {
        this.applyFit();
      }
      return;
    }
    if (sizeChanged && prevWidth > 0 && prevHeight > 0) {
      this.camera.set(recenterCamera(camera, prevWidth, prevHeight, nextWidth, nextHeight));
    }
  }

  private canvasEl(): HTMLCanvasElement | undefined {
    return unwrapElement(this.canvasRef());
  }
}

function unwrapElement<T extends Element>(value: T | ElementRef<T> | undefined): T | undefined {
  if (!value) {
    return undefined;
  }
  return value instanceof ElementRef ? value.nativeElement : value;
}
