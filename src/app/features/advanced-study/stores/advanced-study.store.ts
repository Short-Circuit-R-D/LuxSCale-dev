import { computed, inject, Injectable, signal } from '@angular/core';
import type {
  CalculateRequest,
  FreeFixtureDto,
  Point2D,
} from '../../../core/calculate/dtos/calculate-request.dto';
import type {
  CalculateResponse,
  EvaluationDto,
  FixtureDto,
  VariantResultDto,
} from '../../../core/calculate/dtos/calculate-response.dto';
import type { StandardResponseDto } from '../../../core/standards/dtos/standards.dto';
import type { VariantDetailResponseDto } from '../../../core/variants/dtos/variants.dto';
import type { HeatmapPalette } from '../../../shared/room-plan/heatmap-render';
import { pointInPolygon, snapToGrid } from '../../../shared/room-plan/room-polygon';

export interface AdvancedProjectInfo {
  projectName: string;
  companyName: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
}

const STORAGE_KEY_ADVANCED = 'luxscale_advanced_study';

@Injectable({
  providedIn: 'root',
})
export class AdvancedStudyStore {
  // Wizard navigation
  readonly currentStep = signal<1 | 2 | 3>(1);
  readonly viewMode = signal<'wizard' | 'studio'>('wizard');

  // Step 1: Project & Room
  readonly project = signal<AdvancedProjectInfo>({
    projectName: '',
    companyName: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
  });

  readonly geometryMode = signal<'dimensions' | 'polygon'>('dimensions');
  readonly roomLength = signal<number>(8.0);
  readonly roomWidth = signal<number>(6.0);
  readonly customPolygon = signal<Point2D[]>([
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 4 },
    { x: 4, y: 4 },
    { x: 4, y: 6 },
    { x: 0, y: 6 },
  ]);
  readonly ceilingHeight = signal<number>(3.0);
  readonly mountingHeight = signal<number>(2.8);
  readonly workPlaneHeight = signal<number>(0.8);
  readonly floorZone = signal<number | null>(null);
  readonly wallZone = signal<number | null>(null);


  // Step 2: Photometry & Initial Layout
  readonly photometryMode = signal<'catalog' | 'ies'>('catalog');
  readonly catalogVariants = signal<VariantDetailResponseDto[]>([]);
  readonly selectedVariantIds = signal<string[]>([]);
  readonly selectedVariantsMap = signal<Map<string, VariantDetailResponseDto>>(new Map());

  readonly iesFile = signal<File | null>(null);
  readonly iesFileName = signal<string>('');
  readonly extraIesFiles = signal<File[]>([]);

  readonly gridType = signal<'count' | 'spacing'>('count');
  readonly countX = signal<number>(3);
  readonly countY = signal<number>(2);
  readonly offsetFraction = signal<number>(0.5);
  readonly spacingX = signal<number>(2.4);
  readonly spacingY = signal<number>(2.5);
  readonly autoCenter = signal<boolean>(true);
  readonly luminaireRotation = signal<number>(0);

  // Step 3: Environment & Compliance
  readonly wallReflectance = signal<number>(0.5);
  readonly floorReflectance = signal<number>(0.2);
  readonly ceilingReflectance = signal<number>(0.7);
  readonly maintenanceFactor = signal<number>(0.8);
  readonly bounces = signal<number>(3);
  readonly includeWallCeilingMatrices = signal<boolean>(true);

  readonly standardCategory = signal<string>('');
  readonly taskOrActivity = signal<string>('');
  readonly selectedStandard = signal<StandardResponseDto | null>(null);
  readonly customTargetLux = signal<number | null>(null);
  readonly customTargetUniformity = signal<number | null>(null);

  // Studio Results State
  readonly isCalculating = signal<boolean>(false);
  readonly calculateError = signal<string>('');
  readonly lastResult = signal<CalculateResponse | null>(null);
  readonly lastRequestId = signal<string | null>(null);

  readonly activeStudioTab = signal<'plan' | 'compliance'>('plan');
  readonly activePalette = signal<HeatmapPalette>('false-color');
  readonly showValueChart = signal<boolean>(false);
  readonly selectedVariantIndex = signal<number>(0);

  // Fixture Details Dialog State
  readonly showFixtureDetailsModal = signal<boolean>(false);
  readonly inspectingVariant = signal<VariantDetailResponseDto | null>(null);

  // Per-Fixture Custom IES Files
  readonly perFixtureIesFiles = signal<Map<string, File>>(new Map());

  // Interactive Placement in Studio
  readonly freeFixtures = signal<FreeFixtureDto[]>([]);
  readonly selectedFixtureId = signal<string | null>(null);
  readonly activeLayer = signal<'total' | 'direct' | 'indirect'>('total');
  readonly activeFixtureFilter = signal<string | null>(null);
  readonly isDirty = signal<boolean>(false);

  // Active Variant computed details
  readonly activeVariantDetail = computed<VariantDetailResponseDto | null>(() => {
    const inspecting = this.inspectingVariant();
    if (inspecting) return inspecting;

    const map = this.selectedVariantsMap();
    const lastRes = this.lastResult();
    if (lastRes?.results && lastRes.results.length > 0) {
      const vId = lastRes.results[this.selectedVariantIndex()]?.variantId;
      if (vId && map.has(vId)) return map.get(vId)!;
    }

    const selectedIds = this.selectedVariantIds();
    if (selectedIds.length > 0 && map.has(selectedIds[0])) {
      return map.get(selectedIds[0])!;
    }

    if (map.size > 0) {
      return map.values().next().value ?? null;
    }
    return null;
  });

  readonly activeVariantName = computed<string>(() => {
    const v = this.activeVariantDetail();
    if (v) return v.name;
    if (this.photometryMode() === 'ies' && this.iesFileName()) {
      return this.iesFileName();
    }
    return 'Active Photometry';
  });

  // Computed properties
  readonly polygon = computed<Point2D[]>(() => {
    if (this.geometryMode() === 'polygon') {
      return this.customPolygon();
    }
    const l = Math.max(0.1, this.roomLength());
    const w = Math.max(0.1, this.roomWidth());
    return [
      { x: 0, y: 0 },
      { x: l, y: 0 },
      { x: l, y: w },
      { x: 0, y: w },
    ];
  });

  readonly isStep1Valid = computed(() => {
    const p = this.project();
    const ch = this.ceilingHeight();
    const mh = this.mountingHeight();
    const wh = this.workPlaneHeight();

    if (!p.projectName || !p.companyName || !p.clientName || !p.clientPhone || !p.clientEmail) {
      return false;
    }
    if (ch <= 0) return false;
    if (mh <= 0 || mh > ch) return false;
    if (wh < 0 || wh >= mh) return false;

    if (this.geometryMode() === 'dimensions') {
      const l = this.roomLength();
      const w = this.roomWidth();
      return l > 0 && w > 0;
    }

    const poly = this.customPolygon();
    if (poly.length < 3) return false;
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) > 0.05;
  });


  readonly isStep2Valid = computed(() => {
    if (this.photometryMode() === 'catalog') {
      if (this.selectedVariantIds().length === 0) return false;
    } else {
      if (!this.iesFile()) return false;
    }

    if (this.gridType() === 'count') {
      return this.countX() >= 1 && this.countY() >= 1;
    }
    return this.spacingX() > 0 && this.spacingY() > 0;
  });

  readonly isStep3Valid = computed(() => {
    const wr = this.wallReflectance();
    const fr = this.floorReflectance();
    const cr = this.ceilingReflectance();
    const mf = this.maintenanceFactor();
    const b = this.bounces();

    return (
      wr >= 0 &&
      wr <= 1 &&
      fr >= 0 &&
      fr <= 1 &&
      cr >= 0 &&
      cr <= 1 &&
      mf > 0 &&
      mf <= 1 &&
      b >= 0 &&
      b <= 10
    );
  });

  readonly canProceed = computed(() => {
    const step = this.currentStep();
    if (step === 1) return this.isStep1Valid();
    if (step === 2) return this.isStep2Valid();
    return this.isStep3Valid();
  });

  readonly currentVariantResult = computed<VariantResultDto | null>(() => {
    const res = this.lastResult();
    if (!res || !res.results || res.results.length === 0) return null;
    const index = this.selectedVariantIndex();
    return res.results[index] ?? res.results[0];
  });

  readonly activeEvaluation = computed<EvaluationDto | null>(() => {
    const vResult = this.currentVariantResult();
    if (vResult) return vResult.evaluation;
    return this.lastResult()?.evaluation ?? null;
  });

  readonly activePlacedFixtures = computed<FixtureDto[]>(() => {
    const vResult = this.currentVariantResult();
    if (vResult) return vResult.fixtures;
    return this.lastResult()?.fixtures ?? [];
  });

  readonly selectedFixture = computed<FreeFixtureDto | null>(() => {
    const id = this.selectedFixtureId();
    if (!id) return null;
    return this.freeFixtures().find((f) => f.id === id) ?? null;
  });

  // Action methods
  setStep(step: 1 | 2 | 3) {
    this.currentStep.set(step);
  }

  setGeometryMode(mode: 'dimensions' | 'polygon') {
    this.geometryMode.set(mode);
  }

  addPolygonVertex(x = 0, y = 0) {
    this.customPolygon.update((poly) => [...poly, { x, y }]);
  }

  updatePolygonVertex(index: number, x: number, y: number) {
    this.customPolygon.update((poly) =>
      poly.map((p, i) => (i === index ? { x, y } : p)),
    );
  }

  removePolygonVertex(index: number) {
    this.customPolygon.update((poly) => poly.filter((_, i) => i !== index));
  }

  applyPolygonTemplate(template: 'l-shape' | 't-shape' | 'trapezoid' | 'box') {
    if (template === 'l-shape') {
      this.customPolygon.set([
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 6 },
        { x: 0, y: 6 },
      ]);
    } else if (template === 't-shape') {
      this.customPolygon.set([
        { x: 2, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 4 },
        { x: 8, y: 4 },
        { x: 8, y: 7 },
        { x: 0, y: 7 },
        { x: 0, y: 4 },
        { x: 2, y: 4 },
      ]);
    } else if (template === 'trapezoid') {
      this.customPolygon.set([
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 6, y: 5 },
        { x: 2, y: 5 },
      ]);
    } else if (template === 'box') {
      const l = this.roomLength();
      const w = this.roomWidth();
      this.customPolygon.set([
        { x: 0, y: 0 },
        { x: l, y: 0 },
        { x: l, y: w },
        { x: 0, y: w },
      ]);
    }
  }


  nextStep() {
    const s = this.currentStep();
    if (s < 3) this.currentStep.set((s + 1) as 1 | 2 | 3);
  }

  prevStep() {
    const s = this.currentStep();
    if (s > 1) this.currentStep.set((s - 1) as 1 | 2 | 3);
  }

  updateProject(patch: Partial<AdvancedProjectInfo>) {
    this.project.update((p) => ({ ...p, ...patch }));
  }

  setPhotometryMode(mode: 'catalog' | 'ies') {
    this.photometryMode.set(mode);
  }

  toggleVariantId(variantId: string, detail?: VariantDetailResponseDto) {
    this.selectedVariantIds.update((ids) => {
      if (ids.includes(variantId)) {
        return ids.filter((id) => id !== variantId);
      }
      return [...ids, variantId];
    });
    if (detail) {
      this.selectedVariantsMap.update((map) => {
        const next = new Map(map);
        next.set(detail.id, detail);
        return next;
      });
    }
  }

  setIesFile(file: File | null) {
    this.iesFile.set(file);
    this.iesFileName.set(file ? file.name : '');
  }

  setPalette(palette: HeatmapPalette) {
    this.activePalette.set(palette);
  }

  togglePalette() {
    this.activePalette.update((p) => (p === 'false-color' ? 'brand' : 'false-color'));
  }

  toggleValueChart() {
    this.showValueChart.update((v) => !v);
  }

  setValueChart(show: boolean) {
    this.showValueChart.set(show);
  }

  setStudioTab(tab: 'plan' | 'compliance') {
    this.activeStudioTab.set(tab);
  }

  selectVariant(index: number) {
    this.selectedVariantIndex.set(index);
    const res = this.lastResult();
    if (res?.results && res.results[index]) {
      const vResult = res.results[index];
      if (vResult.fixtures && vResult.fixtures.length > 0) {
        this.initFreeFixtures(vResult.fixtures, vResult.variantId);
      }
    }
  }

  selectFixture(id: string | null) {
    this.selectedFixtureId.set(id);
  }

  setActiveLayer(layer: 'total' | 'direct' | 'indirect', fixtureFilter: string | null = null) {
    this.activeLayer.set(layer);
    this.activeFixtureFilter.set(fixtureFilter);
  }

  openFixtureDetails(variant?: VariantDetailResponseDto | null) {
    this.inspectingVariant.set(variant ?? null);
    this.showFixtureDetailsModal.set(true);
  }

  closeFixtureDetails() {
    this.showFixtureDetailsModal.set(false);
    this.inspectingVariant.set(null);
  }

  /**
   * Initializes free fixtures from CalculateResponse fixtures
   */
  initFreeFixtures(fixtures: FixtureDto[], fallbackVariantId?: string | null) {
    const res = this.lastResult();
    const activeResultVarId = res?.results?.[this.selectedVariantIndex()]?.variantId;
    const defaultVariant = fallbackVariantId ?? activeResultVarId ?? this.selectedVariantIds()[0] ?? null;
    const existingMap = new Map(this.freeFixtures().map((f) => [f.id, f]));

    const list: FreeFixtureDto[] = fixtures.map((f, i) => {
      const id = f.id || `F${i + 1}`;
      const existing = existingMap.get(id);

      let tilt = existing?.tiltAngle ?? 0;
      if (
        existing?.tiltAngle == null &&
        f.aimDirection &&
        (f.aimDirection.z > -0.9999 || f.aimDirection.x !== 0 || f.aimDirection.y !== 0)
      ) {
        const clampedZ = Math.min(1, Math.max(-1, -f.aimDirection.z));
        tilt = Math.round(Math.acos(clampedZ) * (180 / Math.PI));
      }

      return {
        id,
        x: Math.round(f.position.x * 100) / 100,
        y: Math.round(f.position.y * 100) / 100,
        z: Math.round(f.position.z * 100) / 100,
        rotation: f.rotation,
        tiltAngle: tilt,
        aimDirection: f.aimDirection,
        variantId: f.variantId ?? existing?.variantId ?? defaultVariant,
        iesRef: f.iesRef ?? existing?.iesRef ?? null,
      };
    });
    this.freeFixtures.set(list);
    this.isDirty.set(false);
  }

  /**
   * Moves a fixture on the canvas smoothly without grid snapping
   */
  moveFixture(id: string, rawX: number, rawY: number) {
    const poly = this.polygon();
    const cleanX = Math.round(rawX * 100) / 100;
    const cleanY = Math.round(rawY * 100) / 100;

    if (!pointInPolygon({ x: cleanX, y: cleanY }, poly)) {
      return;
    }

    this.freeFixtures.update((fixtures) =>
      fixtures.map((f) => (f.id === id ? { ...f, x: cleanX, y: cleanY } : f)),
    );
    this.isDirty.set(true);
  }

  updateFixture(id: string, patch: Partial<FreeFixtureDto>) {
    this.freeFixtures.update((fixtures) =>
      fixtures.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
    this.isDirty.set(true);
  }

  setFixtureVariant(fixtureId: string, variantId: string) {
    this.perFixtureIesFiles.update((map) => {
      const next = new Map(map);
      next.delete(fixtureId);
      return next;
    });
    this.updateFixture(fixtureId, { variantId, iesRef: null });
  }

  setFixtureIesFile(fixtureId: string, file: File) {
    this.perFixtureIesFiles.update((map) => new Map(map).set(fixtureId, file));
    this.updateFixture(fixtureId, { variantId: null, iesRef: file.name });
  }

  /**
   * Adds a new fixture to the plan inside the room boundary
   */
  addFixtureAt(x?: number, y?: number) {
    const poly = this.polygon();
    let cleanX = x != null ? Math.round(x * 100) / 100 : undefined;
    let cleanY = y != null ? Math.round(y * 100) / 100 : undefined;

    if (cleanX == null || cleanY == null) {
      // Find room bounding box center
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of poly) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      cleanX = Math.round(((minX + maxX) / 2) * 100) / 100;
      cleanY = Math.round(((minY + maxY) / 2) * 100) / 100;

      if (!pointInPolygon({ x: cleanX, y: cleanY }, poly)) {
        cleanX = Math.round((poly[0].x + 0.5) * 100) / 100;
        cleanY = Math.round((poly[0].y + 0.5) * 100) / 100;
      }
    } else if (!pointInPolygon({ x: cleanX, y: cleanY }, poly)) {
      return;
    }

    const current = this.freeFixtures();
    const newId = `F${current.length + 1}`;
    const defaultVariant = this.selectedVariantIds()[0] ?? null;
    const newFixture: FreeFixtureDto = {
      id: newId,
      x: cleanX,
      y: cleanY,
      z: this.mountingHeight(),
      rotation: this.luminaireRotation(),
      tiltAngle: 0,
      variantId: defaultVariant,
      iesRef: null,
    };

    this.freeFixtures.set([...current, newFixture]);
    this.selectedFixtureId.set(newId);
    this.isDirty.set(true);
  }

  duplicateFixture(fixture: FreeFixtureDto) {
    const poly = this.polygon();
    const cleanX = Math.round((fixture.x + 0.5) * 100) / 100;
    const cleanY = Math.round((fixture.y + 0.5) * 100) / 100;
    const targetX = pointInPolygon({ x: cleanX, y: cleanY }, poly) ? cleanX : fixture.x;
    const targetY = pointInPolygon({ x: cleanX, y: cleanY }, poly) ? cleanY : fixture.y;

    const current = this.freeFixtures();
    const newId = `F${current.length + 1}`;
    const newFixture: FreeFixtureDto = {
      ...fixture,
      id: newId,
      x: targetX,
      y: targetY,
    };

    this.freeFixtures.set([...current, newFixture]);
    this.selectedFixtureId.set(newId);
    this.isDirty.set(true);
  }

  deleteFixture(id: string) {
    this.freeFixtures.update((fixtures) => fixtures.filter((f) => f.id !== id));
    if (this.selectedFixtureId() === id) {
      this.selectedFixtureId.set(null);
    }
    this.perFixtureIesFiles.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
    this.isDirty.set(true);
  }

  getAllIesFiles(): { mainFile: File | null; extraFiles: File[] } {
    let main = this.iesFile();
    const extra: File[] = [...this.extraIesFiles()];
    for (const f of this.perFixtureIesFiles().values()) {
      if (!main) {
        main = f;
      } else if (main.name !== f.name && !extra.some((e) => e.name === f.name)) {
        extra.push(f);
      }
    }
    return { mainFile: main, extraFiles: extra };
  }

  /**
   * Builds the CalculateRequest payload for either initial grid or active free fixtures
   */
  buildCalculateRequest(useFreeFixtures = false, overrideVariantId?: string): CalculateRequest {
    const poly = this.polygon();
    const ch = this.ceilingHeight();
    const mh = this.mountingHeight();
    const wh = this.workPlaneHeight();
    const fz = this.floorZone();
    const floorZoneValue = fz != null && Number.isFinite(fz) && fz >= 0 ? fz : undefined;
    const wz = this.wallZone();
    const rot = this.luminaireRotation();
    const wr = this.wallReflectance();
    const fr = this.floorReflectance();
    const cr = this.ceilingReflectance();
    const mf = this.maintenanceFactor();
    const b = this.bounces();

    const standard = this.selectedStandard();
    const compliance = standard
      ? {
          activityId: standard.id,
          targetLux: standard.parameters.em_u_lx ?? standard.parameters.em_r_lx ?? undefined,
          targetUniformity: standard.parameters.uo ?? undefined,
          maxOverdesign: 0.3,
        }
      : this.customTargetLux()
        ? {
            targetLux: this.customTargetLux()!,
            targetUniformity: this.customTargetUniformity() ?? 0.6,
            maxOverdesign: 0.3,
          }
        : undefined;

    const defaultVariant = overrideVariantId ?? this.selectedVariantIds()[0] ?? null;

    const req: CalculateRequest = {
      polygon: poly,
      ceilingHeight: ch,
      mountingHeight: mh,
      workPlaneHeight: wh,
      floorZone: floorZoneValue,
      wallZone: wz,
      luminaireRotation: rot,
      wallReflectance: wr,
      floorReflectance: fr,
      ceilingReflectance: cr,
      maintenanceFactor: mf,
      bounces: b,
      includeWallCeilingMatrices: true,
      compliance,
      variantId: defaultVariant,
    };

    if (useFreeFixtures && this.freeFixtures().length > 0) {
      req.fixtures = this.freeFixtures().map((f) => ({
        id: f.id,
        x: f.x,
        y: f.y,
        z: f.z ?? mh,
        rotation: f.rotation ?? rot,
        tiltAngle: f.tiltAngle ?? 0,
        variantId: f.variantId || (!f.iesRef ? defaultVariant : null),
        iesRef: f.iesRef || null,
      }));
    } else {
      if (this.gridType() === 'count') {
        req.grid = {
          count: {
            countX: this.countX(),
            countY: this.countY(),
            offsetFraction: this.offsetFraction(),
          },
        };
      } else {
        req.grid = {
          spacing: {
            spacingX: this.spacingX(),
            spacingY: this.spacingY(),
            autoCenter: this.autoCenter(),
          },
        };
      }
    }

    return req;
  }

  setCalculationResult(res: CalculateResponse, requestId: string | null) {
    this.lastResult.set(res);
    this.lastRequestId.set(requestId);
    this.isCalculating.set(false);
    this.calculateError.set('');
    this.initFreeFixtures(res.fixtures);
    this.viewMode.set('studio');
    this.saveSession();
  }

  setCalculationError(error: string) {
    this.calculateError.set(error);
    this.isCalculating.set(false);
  }

  saveSession() {
    try {
      const data = {
        project: this.project(),
        roomLength: this.roomLength(),
        roomWidth: this.roomWidth(),
        ceilingHeight: this.ceilingHeight(),
        mountingHeight: this.mountingHeight(),
        workPlaneHeight: this.workPlaneHeight(),
        floorZone: this.floorZone(),
        gridType: this.gridType(),
        countX: this.countX(),
        countY: this.countY(),
        selectedVariantIds: this.selectedVariantIds(),
        wallReflectance: this.wallReflectance(),
        floorReflectance: this.floorReflectance(),
        ceilingReflectance: this.ceilingReflectance(),
        maintenanceFactor: this.maintenanceFactor(),
        bounces: this.bounces(),
      };
      localStorage.setItem(STORAGE_KEY_ADVANCED, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  restoreSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ADVANCED);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.project) this.project.set(data.project);
      if (data.roomLength) this.roomLength.set(data.roomLength);
      if (data.roomWidth) this.roomWidth.set(data.roomWidth);
      if (data.ceilingHeight !== undefined) this.ceilingHeight.set(data.ceilingHeight);
      else if (data.height) this.ceilingHeight.set(data.height);
      if (data.mountingHeight !== undefined) this.mountingHeight.set(data.mountingHeight);
      if (data.workPlaneHeight !== undefined) this.workPlaneHeight.set(data.workPlaneHeight);
      if (data.floorZone !== undefined) this.floorZone.set(data.floorZone);
      if (data.countX) this.countX.set(data.countX);
      if (data.countY) this.countY.set(data.countY);
      if (data.selectedVariantIds) this.selectedVariantIds.set(data.selectedVariantIds);
    } catch {
      // ignore
    }
  }

  reset() {
    this.viewMode.set('wizard');
    this.currentStep.set(1);
    this.ceilingHeight.set(3.0);
    this.mountingHeight.set(2.8);
    this.workPlaneHeight.set(0.8);
    this.floorZone.set(null);
    this.lastResult.set(null);
    this.freeFixtures.set([]);
    this.selectedFixtureId.set(null);
    this.isDirty.set(false);
    this.showValueChart.set(false);
    this.calculateError.set('');
  }
}
