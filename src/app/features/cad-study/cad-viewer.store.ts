import { Injectable, computed, inject, signal } from '@angular/core';
import { CadAnalysisService } from './cad-analysis.service';
import { CadClientError, errorFromHttp, messageForCode } from './cad-error';
import { dividerPayload, normalizeLayout, shouldFitLargest } from './cad-geometry';
import { CadUnit } from './models/cad-unit.model';
import { Layout } from './models/layout.model';
import { Point } from './models/point.model';
import { Segment } from './models/segment.model';

export type CadDrawMode = 'pan' | 'draw';
export type CadFitMode = 'all' | 'largest';

export interface CadLayerVisibility {
  rooms: boolean;
  walls: boolean;
  doors: boolean;
  objects: boolean;
  texts: boolean;
  warnings: boolean;
}

const INITIAL_LAYERS: CadLayerVisibility = {
  rooms: true,
  walls: true,
  doors: true,
  objects: true,
  texts: false,
  warnings: false,
};

const STORAGE_JOB = 'luxscale_cad_job_id';
const STORAGE_SELECTED = 'luxscale_cad_selected_room_id';
const STORAGE_FILE = 'luxscale_cad_file_name';

@Injectable({
  providedIn: 'root',
})
export class CadViewerStore {
  private readonly cadAnalysis = inject(CadAnalysisService);

  readonly jobId = signal<string | null>(null);
  readonly currentLayout = signal<Layout | null>(null);
  readonly draftDividers = signal<Segment[]>([]);
  readonly busy = signal(false);
  readonly error = signal<CadClientError | null>(null);
  readonly engineStatus = signal<'unknown' | 'online' | 'offline'>('unknown');
  readonly engineVersion = signal<string | null>(null);
  readonly fileName = signal<string | null>(null);

  readonly drawMode = signal<CadDrawMode>('pan');
  readonly fitMode = signal<CadFitMode>('largest');
  readonly layers = signal<CadLayerVisibility>({ ...INITIAL_LAYERS });
  readonly selectedRoomId = signal<string | null>(null);
  readonly pendingStart = signal<Point | null>(null);
  readonly previewEnd = signal<Point | null>(null);

  readonly canApply = computed(
    () => !!this.jobId() && this.draftDividers().length > 0 && !this.busy(),
  );
  readonly canUndo = computed(() => this.draftDividers().length > 0 && !this.busy());
  readonly canRestore = computed(() => {
    const layout = this.currentLayout();
    return !!this.jobId() && !this.busy() && (!!layout?.rooms.some((room) => room.kind === 'virtual') || this.draftDividers().length > 0);
  });
  readonly hasLayout = computed(() => !!this.currentLayout());
  readonly unitAssumed = computed(() => !!this.currentLayout()?.meta.unit_assumed);
  readonly sourceUnit = computed(() => this.currentLayout()?.meta.source_unit ?? null);
  readonly layoutWarnings = computed(() => this.currentLayout()?.warnings ?? []);

  checkHealth(): void {
    this.cadAnalysis.health().subscribe({
      next: (res) => {
        const data = res.success ? res.data : undefined;
        this.engineStatus.set(data?.status === 'ok' ? 'online' : 'offline');
        this.engineVersion.set(data?.version ?? null);
      },
      error: () => {
        this.engineStatus.set('offline');
        this.engineVersion.set(null);
      },
    });
  }

  restoreSession(): void {
    if (this.currentLayout() || this.busy()) {
      return;
    }
    const jobId = sessionStorage.getItem(STORAGE_JOB);
    if (!jobId) {
      return;
    }
    this.fileName.set(sessionStorage.getItem(STORAGE_FILE));
    this.loadJob(jobId);
  }

  upload(file: File, unit?: CadUnit): void {
    this.busy.set(true);
    this.error.set(null);
    this.fileName.set(file.name);

    this.cadAnalysis.upload({ file, unit }).subscribe({
      next: (res) => this.handleJobLayout(res),
      error: (err: unknown) => this.handleFailure(err),
    });
  }

  uploadFromR2(r2Url: string, unit?: CadUnit): void {
    this.busy.set(true);
    this.error.set(null);
    this.fileName.set(r2Url);

    this.cadAnalysis.uploadFromR2({ r2_url: r2Url, unit }).subscribe({
      next: (res) => this.handleJobLayout(res),
      error: (err: unknown) => this.handleFailure(err),
    });
  }

  applyDrafts(): void {
    const jobId = this.jobId();
    if (!jobId || this.draftDividers().length === 0 || this.busy()) {
      return;
    }
    this.postDividers(this.draftDividers());
  }

  undoLastDivider(): void {
    if (this.draftDividers().length === 0 || this.busy()) {
      return;
    }
    const remaining = this.draftDividers().slice(0, -1);
    this.draftDividers.set(remaining);
    this.clearPreview();
    if (remaining.length === 0) {
      this.restoreOriginalRooms();
      return;
    }
    this.postDividers(remaining);
  }

  restoreOriginalRooms(): void {
    const jobId = this.jobId();
    if (!jobId || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.cadAnalysis.clearDividers(jobId).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (!res.success || !res.data?.layout) {
          this.setApiError(res.error?.code, res.message || res.error?.detail);
          return;
        }
        this.draftDividers.set([]);
        this.replaceLayout(res.data.layout);
      },
      error: (err: unknown) => this.handleFailure(err),
    });
  }

  addDraftDivider(start: Point, end: Point): void {
    this.draftDividers.update((current) => [...current, { start, end }]);
    this.clearPreview();
  }

  setDrawMode(mode: CadDrawMode): void {
    this.drawMode.set(mode);
    this.clearPreview();
  }

  setFitMode(mode: CadFitMode): void {
    this.fitMode.set(mode);
  }

  toggleLayer(layer: keyof CadLayerVisibility): void {
    this.layers.update((current) => ({ ...current, [layer]: !current[layer] }));
  }

  selectRoom(id: string | null): void {
    this.selectedRoomId.set(id);
    this.persistSelected(id);
  }

  setPendingStart(point: Point | null): void {
    this.pendingStart.set(point);
    if (!point) {
      this.previewEnd.set(null);
    }
  }

  setPreviewEnd(point: Point | null): void {
    this.previewEnd.set(point);
  }

  clearPreview(): void {
    this.pendingStart.set(null);
    this.previewEnd.set(null);
  }

  reset(): void {
    this.jobId.set(null);
    this.currentLayout.set(null);
    this.draftDividers.set([]);
    this.busy.set(false);
    this.error.set(null);
    this.fileName.set(null);
    this.drawMode.set('pan');
    this.fitMode.set('largest');
    this.layers.set({ ...INITIAL_LAYERS });
    this.selectedRoomId.set(null);
    this.clearPreview();
    sessionStorage.removeItem(STORAGE_JOB);
    sessionStorage.removeItem(STORAGE_SELECTED);
    sessionStorage.removeItem(STORAGE_FILE);
  }

  clearError(): void {
    this.error.set(null);
  }

  setClientError(error: CadClientError): void {
    this.error.set(error);
  }

  private loadJob(jobId: string): void {
    this.busy.set(true);
    this.error.set(null);
    this.cadAnalysis.getLayout(jobId).subscribe({
      next: (res) => this.handleJobLayout(res, { keepDrafts: true }),
      error: (err: unknown) => {
        this.handleFailure(err);
        if (this.error()?.code === 'JOB_NOT_FOUND') {
          sessionStorage.removeItem(STORAGE_JOB);
          this.jobId.set(null);
        }
      },
    });
  }

  private handleJobLayout(
    res: { success: boolean; data?: { job_id: string; layout: Layout } | null; message?: string; error?: { code: string; detail: string } },
    options?: { keepDrafts?: boolean },
  ): void {
    if (!res.success || !res.data?.job_id || !res.data.layout) {
      this.busy.set(false);
      this.setApiError(res.error?.code, res.message || res.error?.detail);
      return;
    }
    this.setFromUpload(res.data.job_id, res.data.layout, options);
    this.busy.set(false);
  }

  private setFromUpload(jobId: string, layout: Layout, options?: { keepDrafts?: boolean }): void {
    const normalized = normalizeLayout(layout);
    const previousSelected = this.selectedRoomId() ?? sessionStorage.getItem(STORAGE_SELECTED);
    this.jobId.set(jobId);
    this.currentLayout.set(structuredClone(normalized));
    if (!options?.keepDrafts) {
      this.draftDividers.set([]);
    } else {
      this.draftDividers.set(
        normalized.virtual_dividers
          .filter((divider) => divider.active)
          .map((divider) => ({ start: divider.start, end: divider.end })),
      );
    }
    const stillExists = normalized.rooms.some((room) => room.id === previousSelected);
    this.selectedRoomId.set(stillExists ? previousSelected : null);
    this.clearPreview();
    this.drawMode.set('pan');
    this.fitMode.set(shouldFitLargest(normalized) ? 'largest' : 'all');
    this.layers.set({ ...INITIAL_LAYERS });
    sessionStorage.setItem(STORAGE_JOB, jobId);
    this.persistSelected(this.selectedRoomId());
    const fileName = this.fileName() ?? normalized.meta.source_file;
    if (fileName) {
      this.fileName.set(fileName);
      sessionStorage.setItem(STORAGE_FILE, fileName);
    }
  }

  private postDividers(dividers: Segment[]): void {
    const jobId = this.jobId();
    if (!jobId) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    this.cadAnalysis.applyDividers(jobId, { dividers: dividerPayload(dividers) }).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (!res.success || !res.data?.layout) {
          this.setApiError(res.error?.code, res.message || res.error?.detail);
          return;
        }
        this.replaceLayout(res.data.layout);
      },
      error: (err: unknown) => this.handleFailure(err),
    });
  }

  private replaceLayout(layout: Layout): void {
    const normalized = normalizeLayout(layout);
    const selected = this.selectedRoomId();
    this.currentLayout.set(structuredClone(normalized));
    if (selected && !normalized.rooms.some((room) => room.id === selected)) {
      this.selectedRoomId.set(null);
      this.persistSelected(null);
    }
  }

  private persistSelected(id: string | null): void {
    if (id) {
      sessionStorage.setItem(STORAGE_SELECTED, id);
    } else {
      sessionStorage.removeItem(STORAGE_SELECTED);
    }
  }

  private setApiError(code?: string, detail?: string): void {
    this.error.set({
      code: code ?? 'UNKNOWN',
      message: messageForCode(code ?? 'UNKNOWN', detail),
    });
  }

  private handleFailure(err: unknown): void {
    this.busy.set(false);
    this.error.set(errorFromHttp(err));
  }
}
