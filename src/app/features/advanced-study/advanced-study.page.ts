import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { CalculateApi } from '../../core/calculate/apis/calculate.api';
import type {
  CalculateErrorBody,
  VariantResultDto,
} from '../../core/calculate/dtos/calculate-response.dto';
import { StandardsApi } from '../../core/standards/apis/standards.api';
import type { StandardResponseDto } from '../../core/standards/dtos/standards.dto';
import { VariantsApi } from '../../core/variants/apis/variants.api';
import type { VariantDetailResponseDto } from '../../core/variants/dtos/variants.dto';
import { parseIesFile } from '../../services/ies-parser';
import { RoomPlanPreviewComponent } from '../../shared/room-plan/room-plan-preview.component';
import { SearchableSelectComponent } from '../../shared/searchable-select/searchable-select.component';
import { FixtureInspectorComponent } from './components/fixture-inspector/fixture-inspector.component';
import { MatrixLayersComponent } from './components/matrix-layers/matrix-layers.component';
import { PlanCanvasComponent } from './components/plan-canvas/plan-canvas.component';
import { VariantComparisonComponent } from './components/variant-comparison/variant-comparison.component';
import { FixtureDetailsComponent } from '../results/components/fixture-details/fixture-details.component';
import { AdvancedStudyStore } from './stores/advanced-study.store';

function toMetric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface FixtureGroup {
  fixtureId: string;
  name: string;
  manufacturer: string;
  isMainSolution: boolean;
  variants: VariantDetailResponseDto[];
}

export interface ApplicationGroup {
  application: 'interior' | 'industrial';
  title: string;
  fixtures: FixtureGroup[];
  totalVariants: number;
  selectedCount: number;
}

@Component({
  selector: 'app-advanced-study',
  imports: [
    FormsModule,
    RouterLink,
    DecimalPipe,
    RoomPlanPreviewComponent,
    SearchableSelectComponent,
    PlanCanvasComponent,
    MatrixLayersComponent,
    FixtureInspectorComponent,
    FixtureDetailsComponent,
    VariantComparisonComponent,
  ],
  templateUrl: './advanced-study.page.html',
  styleUrl: './advanced-study.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdvancedStudyPage implements OnInit {
  protected readonly store = inject(AdvancedStudyStore);
  private readonly calculateApi = inject(CalculateApi);
  private readonly standardsApi = inject(StandardsApi);
  private readonly variantsApi = inject(VariantsApi);

  // Standards data
  protected readonly standardCategories = signal<string[]>([]);
  protected readonly taskOrActivities = signal<string[]>([]);
  protected readonly categoriesLoading = signal<boolean>(true);
  protected readonly tasksLoading = signal<boolean>(false);

  // Catalog variants data
  protected readonly catalogVariants = signal<VariantDetailResponseDto[]>([]);
  protected readonly catalogLoading = signal<boolean>(true);

  // Accordion open/close state for application grouping
  protected readonly interiorOpen = signal<boolean>(true);
  protected readonly industrialOpen = signal<boolean>(true);

  // Grouped variants by Application and parent Fixture
  protected readonly groupedApplications = computed<ApplicationGroup[]>(() => {
    const variants = this.catalogVariants();
    const selectedIds = new Set(this.store.selectedVariantIds());

    const apps: Array<{ key: 'interior' | 'industrial'; title: string }> = [
      { key: 'interior', title: 'Interior Lighting' },
      { key: 'industrial', title: 'Industrial Lighting' },
    ];

    return apps.map(({ key, title }) => {
      const appVariants = variants.filter((v) => {
        const fixtureApps = v.fixture?.applications;
        if (!fixtureApps || fixtureApps.length === 0) {
          return key === 'interior';
        }
        return fixtureApps.includes(key);
      });

      const fixtureMap = new Map<string, FixtureGroup>();
      for (const v of appVariants) {
        const fId = v.fixture?.id ?? v.fixture_id ?? 'unknown';
        let group = fixtureMap.get(fId);
        if (!group) {
          group = {
            fixtureId: fId,
            name: v.fixture?.name ?? 'Standard Luminaire',
            manufacturer: v.fixture?.manufacturer_name ?? 'Catalog',
            isMainSolution: !!v.fixture?.is_main_solution,
            variants: [],
          };
          fixtureMap.set(fId, group);
        }
        group.variants.push(v);
      }

      return {
        application: key,
        title,
        fixtures: Array.from(fixtureMap.values()),
        totalVariants: appVariants.length,
        selectedCount: appVariants.filter((v) => selectedIds.has(v.id)).length,
      };
    });
  });

  toggleAccordion(app: 'interior' | 'industrial') {
    if (app === 'interior') {
      this.interiorOpen.update((v) => !v);
    } else {
      this.industrialOpen.update((v) => !v);
    }
  }

  isFixtureFullySelected(variants: VariantDetailResponseDto[]): boolean {
    if (variants.length === 0) return false;
    const selected = this.store.selectedVariantIds();
    return variants.every((v) => selected.includes(v.id));
  }

  toggleFixtureAll(variants: VariantDetailResponseDto[]) {
    const isAll = this.isFixtureFullySelected(variants);
    for (const v of variants) {
      const isSelected = this.store.selectedVariantIds().includes(v.id);
      if (isAll && isSelected) {
        this.store.toggleVariantId(v.id, v);
      } else if (!isAll && !isSelected) {
        this.store.toggleVariantId(v.id, v);
      }
    }
  }

  // Phone and email validation
  protected readonly phoneError = signal('');
  protected readonly emailError = signal('');

  // IES parsed summary
  protected readonly iesParsedDetails = signal<{
    luminaire: string;
    lumens: number;
    symmetry: string;
  } | null>(null);

  protected readonly heightError = computed(() => {
    const ch = this.store.ceilingHeight();
    const mh = this.store.mountingHeight();
    const wh = this.store.workPlaneHeight();
    if (ch <= 0) {
      return 'Ceiling height must be greater than 0';
    }
    if (mh <= 0) {
      return 'Mounting height must be greater than 0';
    }
    if (mh > ch) {
      return 'Mounting height cannot exceed ceiling height';
    }
    if (wh < 0) {
      return 'Workplane height cannot be negative';
    }
    if (wh >= mh) {
      return 'Workplane height must be below mounting height';
    }
    return '';
  });

  ngOnInit() {
    this.store.restoreSession();

    // Load Standards categories
    this.standardsApi
      .listCategories()
      .pipe(
        map((res) =>
          res.data.map((c) => `${c.category_table_number} – ${c.category_title}`),
        ),
      )
      .subscribe({
        next: (categories) => {
          this.standardCategories.set(categories);
          this.categoriesLoading.set(false);
        },
        error: () => {
          this.standardCategories.set([]);
          this.categoriesLoading.set(false);
        },
      });

    // Load all Catalog variants
    this.variantsApi
      .listAllVariants({ limit: 100 })
      .subscribe({
        next: (res) => {
          this.catalogVariants.set(res.data);
          this.store.catalogVariants.set(res.data);
          this.catalogLoading.set(false);

          // Populate store map
          const map = new Map<string, VariantDetailResponseDto>();
          for (const v of res.data) {
            map.set(v.id, v);
          }
          this.store.selectedVariantsMap.set(map);

          // Default select first variant if empty
          if (this.store.selectedVariantIds().length === 0 && res.data.length > 0) {
            this.store.toggleVariantId(res.data[0].id, res.data[0]);
          }
        },
        error: () => {
          this.catalogLoading.set(false);
        },
      });
  }

  // Dimension & Input Handlers
  onLengthInput(value: unknown) {
    const n = toMetric(value);
    if (n && n > 0) this.store.roomLength.set(n);
  }

  onWidthInput(value: unknown) {
    const n = toMetric(value);
    if (n && n > 0) this.store.roomWidth.set(n);
  }

  protected toNum(val: unknown): number {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }


  onCeilingHeightInput(value: unknown) {
    const n = toMetric(value);
    if (n != null) this.store.ceilingHeight.set(n);
  }

  onMountingHeightInput(value: unknown) {
    const n = toMetric(value);
    if (n != null) this.store.mountingHeight.set(n);
  }

  onWorkPlaneInput(value: unknown) {
    const n = toMetric(value);
    if (n != null && n >= 0) this.store.workPlaneHeight.set(n);
  }

  onFloorZoneInput(value: unknown) {
    const n = toMetric(value);
    this.store.floorZone.set(n != null && n >= 0 ? n : null);
  }

  onPhoneInput(value: string) {
    this.store.updateProject({ clientPhone: value });
    if (value) {
      const phoneRegex = /^\+?[\d\s\-()]{7,20}$/;
      this.phoneError.set(phoneRegex.test(value) ? '' : 'Invalid phone number');
    } else {
      this.phoneError.set('');
    }
  }

  onEmailInput(value: string) {
    this.store.updateProject({ clientEmail: value });
    if (value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      this.emailError.set(emailRegex.test(value) ? '' : 'Invalid email address');
    } else {
      this.emailError.set('');
    }
  }

  onStandardSelect(value: string) {
    this.store.standardCategory.set(value);
    this.store.taskOrActivity.set('');
    this.store.selectedStandard.set(null);
    this.loadTasks(value);
  }

  onTaskSelect(value: string) {
    this.store.taskOrActivity.set(value);
    this.loadStandardObject(value);
  }

  private loadTasks(category: string) {
    const tableNumber = category.split(' – ')[0]?.trim() ?? category;
    this.tasksLoading.set(true);
    this.standardsApi
      .listStandards({ category_table_number: tableNumber, limit: 100 })
      .pipe(
        map((res) =>
          res.data.map((entry) => `${entry.activity} (${entry.hierarchy.ref_number})`),
        ),
      )
      .subscribe({
        next: (tasks) => {
          this.taskOrActivities.set(tasks);
          this.tasksLoading.set(false);
        },
        error: () => {
          this.taskOrActivities.set([]);
          this.tasksLoading.set(false);
        },
      });
  }

  private loadStandardObject(taskWithRef: string) {
    const category = this.store.standardCategory();
    const tableNumber = category.split(' – ')[0]?.trim() ?? category;
    const refNo = taskWithRef.match(/\(([^)]+)\)$/)?.[1];
    this.standardsApi
      .listStandards({ category_table_number: tableNumber, limit: 100 })
      .pipe(
        map(
          (res) =>
            res.data.find((entry) => entry.hierarchy.ref_number === refNo) ?? null,
        ),
      )
      .subscribe({
        next: (entry) => this.store.selectedStandard.set(entry),
        error: () => this.store.selectedStandard.set(null),
      });
  }

  // File Upload Handlers for IES
  onFileDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processIesFile(files[0]);
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processIesFile(input.files[0]);
    }
  }

  private processIesFile(file: File) {
    this.store.setIesFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseIesFile(text);
        const name =
          parsed.metadata['[LUMCAT]'] ||
          parsed.metadata['[LUMINAIRE]'] ||
          file.name.replace(/\.ies$/i, '');
        this.iesParsedDetails.set({
          luminaire: name,
          lumens: Math.round(parsed.photometricParams.lumensPerLamp),
          symmetry: parsed.symmetry.label,
        });
      } catch {
        this.iesParsedDetails.set(null);
      }
    };
    reader.readAsText(file);
  }

  // Simulation execution
  runSimulation(useFreeFixtures = false) {
    if (this.store.isCalculating()) return;

    this.store.isCalculating.set(true);
    this.store.calculateError.set('');

    const { mainFile, extraFiles } = this.store.getAllIesFiles();
    const isIesMode = this.store.photometryMode() === 'ies' || mainFile != null;

    if (useFreeFixtures || isIesMode) {
      const req = this.store.buildCalculateRequest(useFreeFixtures);
      const call$ =
        isIesMode && mainFile
          ? this.calculateApi.calculateMultipart(req, mainFile, extraFiles)
          : this.calculateApi.calculate(req);

      call$.subscribe({
        next: ({ data, requestId }) => {
          this.store.setCalculationResult(data, requestId);
        },
        error: (err: unknown) => {
          this.store.setCalculationError(this.messageFromError(err));
        },
      });
      return;
    }

    // Wizard Step 3 Catalog Photometry: Multi-Variant Benchmark via concurrent calls
    const selectedVariantIds = this.store.selectedVariantIds();
    if (selectedVariantIds.length === 0) {
      this.store.setCalculationError('Please select at least one luminaire variant.');
      return;
    }

    if (selectedVariantIds.length === 1) {
      const req = this.store.buildCalculateRequest(false, selectedVariantIds[0]);
      this.calculateApi.calculate(req).subscribe({
        next: ({ data, requestId }) => {
          this.store.setCalculationResult(data, requestId);
        },
        error: (err: unknown) => {
          this.store.setCalculationError(this.messageFromError(err));
        },
      });
      return;
    }

    // Multiple variants selected: run concurrent calls via forkJoin
    const calls$ = selectedVariantIds.map((vId) => {
      const req = this.store.buildCalculateRequest(false, vId);
      return this.calculateApi.calculate(req);
    });

    forkJoin(calls$).subscribe({
      next: (responses) => {
        if (!responses || responses.length === 0) {
          this.store.setCalculationError('No calculation results returned.');
          return;
        }

        const primary = responses[0].data;
        const primaryRequestId = responses[0].requestId;

        const benchmarkResults: VariantResultDto[] = responses.map((res, i) => ({
          variantId: selectedVariantIds[i],
          evaluation: res.data.evaluation,
          compliance: res.data.compliance,
          powerW: res.data.powerW ?? null,
          powerDensity: res.data.powerDensity ?? null,
          totalFloorIlluminance: res.data.totalFloorIlluminance,
          fixtures: res.data.fixtures,
          directFloorMatrices: res.data.directFloorMatrices,
          indirectFloorMatrices: res.data.indirectFloorMatrices,
        }));

        primary.results = benchmarkResults;
        this.store.setCalculationResult(primary, primaryRequestId);
      },
      error: (err: unknown) => {
        this.store.setCalculationError(this.messageFromError(err));
      },
    });
  }

  private messageFromError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.error) {
        const body = err.error as CalculateErrorBody;
        if (body.error) {
          const details = body.error.details
            ?.map((d) => `${d.field}: ${d.issue}`)
            .join(' ');
          return details
            ? `${body.error.message} (${details})`
            : body.error.message;
        }
        if (typeof err.error === 'string' && err.error.trim()) {
          return err.error;
        }
      }
      if (err.status === 422) return 'Request validation failed. Check room dimensions and grid parameters.';
      if (err.status === 400) return 'IES or geometry error. Ensure non-zero area and standard IES TILT=NONE.';
      if (err.status === 500) return 'Radiosity calculation failed on server. Try adjusting grid density.';
    }
    return 'Calculation failed. Please check network connectivity and parameters.';
  }

  // Presets
  applyReflectancePreset(preset: 'office' | 'warehouse' | 'cleanroom') {
    if (preset === 'office') {
      this.store.ceilingReflectance.set(0.7);
      this.store.wallReflectance.set(0.5);
      this.store.floorReflectance.set(0.2);
    } else if (preset === 'warehouse') {
      this.store.ceilingReflectance.set(0.5);
      this.store.wallReflectance.set(0.3);
      this.store.floorReflectance.set(0.1);
    } else if (preset === 'cleanroom') {
      this.store.ceilingReflectance.set(0.8);
      this.store.wallReflectance.set(0.7);
      this.store.floorReflectance.set(0.3);
    }
  }
}
