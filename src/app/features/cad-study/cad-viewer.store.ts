import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject, of, takeUntil } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { CalculationResponse } from '../../services/calculation-result.service';
import { FixtureResult, ResultStoreService } from '../../services/result-store.service';
import { CadAnalysisService } from './cad-analysis.service';
import { CadClientError, errorFromHttp, messageForCode } from './cad-error';
import { normalizeLayout, roomPolygon } from './cad-geometry';
import { CadUnit } from './models/cad-unit.model';
import { Face } from './models/face.model';
import { Layout } from './models/layout.model';
import { Point } from './models/point.model';
import { Room } from './models/room.model';

export type CadTool = 'pan' | 'select' | 'split' | 'restore';
export type CadFitMode = 'all' | 'largest';
export type CadActiveTab = 'analysis' | string;

export interface CadRoomStudy {
  id: string;
  title: string;
  roomId: string;
  result: CalculationResponse;
  fixtureResults: FixtureResult[];
  fallbackFields: Set<string>;
  vertices: Point[];
  holes: Point[][];
}

export type CadRoomStudyDraft = Omit<CadRoomStudy, 'id' | 'fixtureResults'>;

export interface CadLayerVisibility {
  rooms: boolean;
  discardedFaces: boolean;
  walls: boolean;
  doors: boolean;
  windows: boolean;
  virtualDividers: boolean;
  objects: boolean;
  texts: boolean;
}

const INITIAL_LAYERS: CadLayerVisibility = {
  rooms: true,
  discardedFaces: true,
  walls: true,
  doors: false,
  windows: true,
  virtualDividers: true,
  objects: false,
  texts: false,
};

const STORAGE_JOB = 'luxscale_cad_job_id';
const STORAGE_SELECTED = 'luxscale_cad_selected_room_id';
const STORAGE_FILE = 'luxscale_cad_file_name';

@Injectable({
  providedIn: 'root',
})
export class CadViewerStore {
  private readonly cadAnalysis = inject(CadAnalysisService);
  private readonly resultStore = inject(ResultStoreService);
  private readonly cancelPoll$ = new Subject<void>();
  private facesInFlight: string | null = null;

  readonly jobId = signal<string | null>(null);
  readonly currentLayout = signal<Layout | null>(null);
  readonly faces = signal<Face[]>([]);
  readonly busy = signal(false);
  readonly error = signal<CadClientError | null>(null);
  readonly engineStatus = signal<'unknown' | 'online' | 'offline'>('unknown');
  readonly engineVersion = signal<string | null>(null);
  readonly fileName = signal<string | null>(null);
  readonly busyLabel = signal('Analyzing drawing');

  readonly tool = signal<CadTool>('pan');
  readonly fitMode = signal<CadFitMode>('largest');
  readonly layers = signal<CadLayerVisibility>({ ...INITIAL_LAYERS });
  readonly physicalRoomsOnly = signal(false);
  readonly showAllFaces = signal(false);
  readonly selectedRoomIds = signal<string[]>([]);
  readonly selectedFaceId = signal<string | null>(null);
  readonly pendingStart = signal<Point | null>(null);
  readonly previewEnd = signal<Point | null>(null);
  readonly renameOpen = signal(false);
  readonly resetConfirmOpen = signal(false);
  readonly roomStudyOpen = signal(false);
  readonly roomStudies = signal<CadRoomStudy[]>([]);
  readonly activeTab = signal<CadActiveTab>('analysis');

  readonly selectedRoomId = computed(() => this.selectedRoomIds().at(-1) ?? null);
  readonly selectedRoom = computed((): Room | null => {
    const id = this.selectedRoomId();
    const layout = this.currentLayout();
    if (!id || !layout) {
      return null;
    }
    return (
      layout.rooms.find((item) => item.id === id) ??
      layout.physical_rooms.find((item) => item.id === id) ??
      null
    );
  });
  readonly modalOpen = computed(() => this.resetConfirmOpen() || this.roomStudyOpen());
  readonly hasLayout = computed(() => !!this.currentLayout());
  readonly unitAssumed = computed(() => this.currentLayout()?.meta.unit_source === 'fallback');
  readonly sourceUnit = computed(() => this.currentLayout()?.meta.unit ?? null);
  readonly discardedFaces = computed(() => this.faces().filter((face) => !face.accepted_as_room));
  readonly canUndo = computed(() => !!this.jobId() && !this.busy());
  readonly canClearDividers = computed(
    () =>
      !!this.jobId() && !this.busy() && (this.currentLayout()?.virtual_dividers.length ?? 0) > 0,
  );
  readonly canMerge = computed(
    () => !!this.jobId() && !this.busy() && this.selectedRoomIds().length >= 2,
  );
  readonly canDelete = computed(
    () => !!this.jobId() && !this.busy() && this.selectedRoomIds().length === 1,
  );
  readonly canRename = computed(
    () => !!this.jobId() && !this.busy() && this.selectedRoomIds().length === 1,
  );
  readonly canStudy = computed(() => {
    if (!this.jobId() || this.busy() || this.selectedRoomIds().length !== 1) {
      return false;
    }
    const room = this.selectedRoom();
    return !!room && roomPolygon(room).vertices.length >= 3;
  });
  readonly canResetJob = computed(() => !!this.jobId() && !this.busy());

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
    this.busyLabel.set('Loading job');
    this.startPolling(jobId);
  }

  upload(file: File, unit?: CadUnit): void {
    this.cancelPolling();
    this.busy.set(true);
    this.error.set(null);
    this.fileName.set(file.name);
    this.busyLabel.set('Analyzing drawing');
    sessionStorage.setItem(STORAGE_FILE, file.name);

    this.cadAnalysis
      .upload({ file, unit })
      .pipe(takeUntil(this.cancelPoll$))
      .subscribe({
        next: (res) => {
          if (!res.success || !res.data?.job_id) {
            this.busy.set(false);
            this.setApiError(res.error?.code, res.message || res.error?.detail);
            return;
          }
          if (res.data.layout) {
            this.setFromUpload(res.data.job_id, res.data.layout);
            this.busy.set(false);
            setTimeout(() => this.ensureFaces());
            return;
          }
          this.startPolling(res.data.job_id);
        },
        error: (err: unknown) => this.handleFailure(err),
      });
  }

  openJob(jobId: string): void {
    this.cancelPolling();
    this.busy.set(true);
    this.error.set(null);
    this.fileName.set(jobId);
    this.busyLabel.set('Loading job');
    sessionStorage.setItem(STORAGE_FILE, jobId);
    this.startPolling(jobId);
  }

  setTool(tool: CadTool): void {
    this.tool.set(tool);
    this.clearPreview();
    this.renameOpen.set(false);
    if (tool === 'restore') {
      this.layers.update((current) =>
        current.discardedFaces ? current : { ...current, discardedFaces: true },
      );
      this.ensureFaces();
    }
  }

  setFitMode(mode: CadFitMode): void {
    this.fitMode.set(mode);
  }

  toggleLayer(layer: keyof CadLayerVisibility): void {
    this.layers.update((current) => ({ ...current, [layer]: !current[layer] }));
    if (layer === 'discardedFaces' && this.layers().discardedFaces) {
      this.ensureFaces();
    }
  }

  setPhysicalRoomsOnly(enabled: boolean): void {
    this.physicalRoomsOnly.set(enabled);
    if (enabled) {
      this.showAllFaces.set(false);
    }
  }

  setShowAllFaces(enabled: boolean): void {
    this.showAllFaces.set(enabled);
    if (enabled) {
      this.physicalRoomsOnly.set(false);
      this.ensureFaces();
    }
  }

  selectRoom(id: string | null, options?: { additive?: boolean }): void {
    this.selectedFaceId.set(null);
    if (!id) {
      this.selectedRoomIds.set([]);
      this.persistSelected(null);
      return;
    }
    if (options?.additive) {
      const current = this.selectedRoomIds();
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      this.selectedRoomIds.set(next);
      this.persistSelected(next.at(-1) ?? null);
      return;
    }
    this.selectedRoomIds.set([id]);
    this.persistSelected(id);
  }

  selectFace(id: string | null): void {
    this.selectedRoomIds.set([]);
    this.persistSelected(null);
    this.selectedFaceId.set(id);
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

  splitWithDivider(start: Point, end: Point): void {
    const jobId = this.jobId();
    if (!jobId || this.busy()) {
      return;
    }
    this.clearPreview();
    this.runMutation(
      this.cadAnalysis.createDivider(jobId, {
        start_x: start.x,
        start_y: start.y,
        end_x: end.x,
        end_y: end.y,
        expected_layout_rev: this.layoutRev(),
      }),
    );
  }

  undo(): void {
    this.postAction('undo');
  }

  clearDividers(): void {
    const jobId = this.jobId();
    if (!jobId || this.busy()) {
      return;
    }
    this.runMutation(this.cadAnalysis.clearDividers(jobId));
  }

  mergeSelectedRooms(): void {
    const ids = this.selectedRoomIds();
    if (ids.length < 2) {
      return;
    }
    this.postAction('merge_rooms', ids);
  }

  deleteSelectedRooms(): void {
    const ids = this.selectedRoomIds();
    if (ids.length !== 1) {
      return;
    }
    this.postAction('delete_room', ids);
  }

  restoreFace(id: string): void {
    if (!id || this.busy() || !this.jobId()) {
      return;
    }
    if (!this.discardedFaces().some((face) => face.id === id)) {
      return;
    }
    this.selectedFaceId.set(null);
    this.postAction('restore_face', [id]);
  }

  openRename(): void {
    if (!this.canRename()) {
      return;
    }
    this.roomStudyOpen.set(false);
    this.renameOpen.set(true);
  }

  cancelRename(): void {
    this.renameOpen.set(false);
  }

  openRoomStudy(): void {
    if (!this.canStudy()) {
      return;
    }
    this.renameOpen.set(false);
    this.roomStudyOpen.set(true);
  }

  cancelRoomStudy(): void {
    this.roomStudyOpen.set(false);
  }

  selectTab(tab: CadActiveTab): void {
    if (tab === 'analysis' || this.roomStudies().some((study) => study.id === tab)) {
      this.activeTab.set(tab);
    }
  }

  addRoomStudy(draft: CadRoomStudyDraft): string {
    const id = crypto.randomUUID();
    this.roomStudies.update((list) => [...list, { ...draft, id, fixtureResults: [] }]);
    this.activeTab.set(id);
    this.roomStudyOpen.set(false);
    this.resultStore
      .fetchFixtureResults(draft.result)
      .pipe(takeUntil(this.cancelPoll$))
      .subscribe((fixtureResults) => {
        this.roomStudies.update((list) =>
          list.map((study) => (study.id === id ? { ...study, fixtureResults } : study)),
        );
      });
    return id;
  }

  closeRoomStudy(id: string): void {
    this.roomStudies.update((list) => list.filter((study) => study.id !== id));
    if (this.activeTab() === id) {
      this.activeTab.set('analysis');
    }
  }

  openResetConfirm(): void {
    if (!this.canResetJob()) {
      return;
    }
    this.renameOpen.set(false);
    this.roomStudyOpen.set(false);
    this.resetConfirmOpen.set(true);
  }

  cancelResetConfirm(): void {
    this.resetConfirmOpen.set(false);
  }

  confirmResetJob(): void {
    const jobId = this.jobId();
    this.resetConfirmOpen.set(false);
    if (!jobId || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.busyLabel.set('Resetting to original');
    this.cadAnalysis
      .resetJob(jobId)
      .pipe(takeUntil(this.cancelPoll$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data?.layout) {
            this.handleJobLayout(res);
            return;
          }
          this.reloadSnapshot(jobId);
        },
        error: (err: unknown) => this.handleFailure(err),
      });
  }

  renameSelectedRoom(name: string): void {
    const id = this.selectedRoomId();
    const trimmed = name.trim();
    if (!id || !trimmed) {
      this.setClientError({
        code: 'VALIDATION_ERROR',
        message: 'Enter a name for the selected room.',
      });
      return;
    }
    this.renameOpen.set(false);
    this.postAction('rename_room', [id], { name: trimmed });
  }

  reset(): void {
    this.cancelPolling();
    this.jobId.set(null);
    this.currentLayout.set(null);
    this.faces.set([]);
    this.busy.set(false);
    this.error.set(null);
    this.fileName.set(null);
    this.tool.set('pan');
    this.fitMode.set('largest');
    this.layers.set({ ...INITIAL_LAYERS });
    this.physicalRoomsOnly.set(false);
    this.showAllFaces.set(false);
    this.selectedRoomIds.set([]);
    this.selectedFaceId.set(null);
    this.renameOpen.set(false);
    this.resetConfirmOpen.set(false);
    this.roomStudyOpen.set(false);
    this.roomStudies.set([]);
    this.activeTab.set('analysis');
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

  private postAction(
    action: 'undo' | 'merge_rooms' | 'delete_room' | 'restore_face' | 'rename_room',
    targetIds?: string[],
    payload?: Record<string, unknown>,
  ): void {
    const jobId = this.jobId();
    if (!jobId || this.busy()) {
      return;
    }
    this.runMutation(
      this.cadAnalysis.postEvent(jobId, {
        action,
        target_ids: targetIds,
        payload,
        expected_layout_rev: this.layoutRev(),
        actor: 'user',
      }),
    );
  }

  private runMutation(request: ReturnType<CadAnalysisService['postEvent']>): void {
    const jobId = this.jobId();
    if (!jobId) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.busyLabel.set('Updating layout');
    request.pipe(takeUntil(this.cancelPoll$)).subscribe({
      next: () => this.reloadSnapshot(jobId),
      error: (err: unknown) => this.handleFailure(err),
    });
  }

  private reloadSnapshot(jobId: string): void {
    this.busy.set(true);
    this.busyLabel.set('Updating layout');
    this.cadAnalysis
      .layoutStatus(jobId)
      .pipe(takeUntil(this.cancelPoll$))
      .subscribe({
        next: (result) => {
          if (result.pending) {
            this.startPolling(jobId, { keepSelection: true });
            return;
          }
          this.handleJobLayout(result.response, { keepSelection: true });
        },
        error: (err: unknown) => this.handleFailure(err),
      });
  }

  private startPolling(jobId: string, options?: { keepSelection?: boolean }): void {
    this.cancelPolling();
    this.jobId.set(jobId);
    this.busy.set(true);
    this.error.set(null);
    sessionStorage.setItem(STORAGE_JOB, jobId);
    this.cadAnalysis
      .pollLayout(jobId)
      .pipe(takeUntil(this.cancelPoll$))
      .subscribe({
        next: (res) => this.handleJobLayout(res, options),
        error: (err: unknown) => {
          this.handleFailure(err);
          if (this.error()?.code === 'JOB_NOT_FOUND') {
            sessionStorage.removeItem(STORAGE_JOB);
            this.jobId.set(null);
          }
        },
      });
  }

  private cancelPolling(): void {
    this.cancelPoll$.next();
    this.facesInFlight = null;
  }

  private handleJobLayout(
    res: {
      success: boolean;
      data?: { job_id: string; layout: Layout } | null;
      message?: string;
      error?: { code: string; detail: string };
    },
    options?: { keepSelection?: boolean },
  ): void {
    if (!res.success || !res.data?.layout) {
      this.busy.set(false);
      this.setApiError(res.error?.code, res.message || res.error?.detail);
      return;
    }
    const jobId = res.data.job_id || res.data.layout.meta?.job_id || this.jobId();
    if (!jobId) {
      this.busy.set(false);
      this.setApiError(res.error?.code, res.message || res.error?.detail);
      return;
    }
    this.setFromUpload(jobId, res.data.layout, options);
    this.busy.set(false);
    setTimeout(() => this.ensureFaces());
  }

  private ensureFaces(): void {
    const jobId = this.jobId();
    if (!jobId || this.faces().length > 0 || this.facesInFlight === jobId) {
      return;
    }
    this.loadFaces(jobId);
  }

  private loadFaces(jobId: string): void {
    this.facesInFlight = jobId;
    this.cadAnalysis
      .getFaces(jobId)
      .pipe(
        takeUntil(this.cancelPoll$),
        catchError(() => of([] as Face[])),
        finalize(() => {
          if (this.facesInFlight === jobId) {
            this.facesInFlight = null;
          }
        }),
      )
      .subscribe((faces) => {
        if (this.jobId() !== jobId) {
          return;
        }
        this.faces.set(faces);
        const selected = this.selectedFaceId();
        if (selected && !faces.some((face) => face.id === selected)) {
          this.selectedFaceId.set(null);
        }
      });
  }

  private setFromUpload(
    jobId: string,
    layout: Layout,
    options?: { keepSelection?: boolean },
  ): void {
    const normalized = normalizeLayout(layout);
    const previousSelected = this.selectedRoomId() ?? sessionStorage.getItem(STORAGE_SELECTED);
    this.jobId.set(jobId);
    this.currentLayout.set(structuredClone(normalized));
    this.faces.set([]);
    this.clearPreview();
    if (!options?.keepSelection) {
      this.tool.set('pan');
      this.fitMode.set('largest');
      this.layers.set({ ...INITIAL_LAYERS });
      this.physicalRoomsOnly.set(false);
      this.showAllFaces.set(false);
    }
    const stillSelected = this.selectedRoomIds().filter(
      (id) =>
        normalized.rooms.some((room) => room.id === id) ||
        normalized.physical_rooms.some((room) => room.id === id),
    );
    const fallback =
      previousSelected &&
      (normalized.rooms.some((room) => room.id === previousSelected) ||
        normalized.physical_rooms.some((room) => room.id === previousSelected))
        ? [previousSelected]
        : [];
    const nextSelected =
      options?.keepSelection && stillSelected.length > 0 ? stillSelected : fallback;
    this.selectedRoomIds.set(nextSelected);
    sessionStorage.setItem(STORAGE_JOB, jobId);
    this.persistSelected(nextSelected.at(-1) ?? null);
    const fileName = this.fileName() ?? normalized.meta.job_id;
    if (fileName) {
      this.fileName.set(fileName);
      sessionStorage.setItem(STORAGE_FILE, fileName);
    }
  }

  private layoutRev(): number | undefined {
    const rev = this.currentLayout()?.meta.layout_rev;
    return typeof rev === 'number' ? rev : undefined;
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
