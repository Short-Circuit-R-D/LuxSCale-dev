import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { applyStandardFallbacks, CalculationResponse } from '../../services/calculation-result.service';
import { CalculatePayload, LayoutPayload, LuxScaleService, StandardEntry } from '../../services/luxscale.service';
import { ResultStoreService } from '../../services/result-store.service';
import { RoomPlanPreviewComponent } from '../../shared/room-plan/room-plan-preview.component';
import { layoutErrorList, validateCustomLayout } from '../../shared/room-plan/user-grid-pack';
import { SearchableSelectComponent } from '../../shared/searchable-select/searchable-select.component';
import { createStudyStore, TechnicalSpecs } from './stores/study-form.store';

function toMetric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

@Component({
  selector: 'app-create-study',
  imports: [FormsModule, RouterLink, RoomPlanPreviewComponent, SearchableSelectComponent],
  templateUrl: './create-study.page.html',
  styleUrl: './create-study.page.css',
})
export class CreateStudyPage implements OnInit {
  protected readonly store = createStudyStore();
  private readonly luxscaleService = inject(LuxScaleService);
  private readonly router = inject(Router);
  private readonly resultStore = inject(ResultStoreService);

  protected readonly standardCategories = signal<string[]>([]);
  protected readonly taskOrActivities = signal<string[]>([]);
  protected readonly selectedStandard = signal<StandardEntry | null>(null);
  protected readonly categoriesLoading = signal(true);
  protected readonly tasksLoading = signal(false);

  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal('');

  protected readonly phoneError = signal('');
  protected readonly emailError = signal('');

  protected readonly isStep1Valid = computed(() => {
    const p = this.store.project();
    if (!p.projectName || !p.companyName || !p.clientName || !p.clientPhone || !p.clientEmail) {
      return false;
    }
    const phoneRegex = /^\+?[\d\s\-()]{7,20}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return phoneRegex.test(p.clientPhone) && emailRegex.test(p.clientEmail);
  });

  protected readonly isStep2Valid = computed(() => {
    const t = this.store.technical();
    return !!(
      t.width1 !== null &&
      t.length1 !== null &&
      t.width2 !== null &&
      t.length2 !== null &&
      t.ceilingHeight !== null &&
      t.mountingHeight !== null &&
      t.standardCategory &&
      t.taskOrActivity
    );
  });

  protected readonly layoutErrors = computed(() => {
    const t = this.store.technical();
    if (!t.customInstall) return [];
    const lengthX = Math.max(t.width1 ?? 0, t.width2 ?? 0);
    const widthY = Math.max(t.length1 ?? 0, t.length2 ?? 0);
    return layoutErrorList(
      validateCustomLayout(
        lengthX,
        widthY,
        t.spacingX,
        t.spacingY,
        t.offsetStartX,
        t.offsetStartY,
        t.offsetEndMinX,
        t.offsetEndMinY,
      ),
    );
  });

  protected readonly canProceed = computed(() => {
    if (this.store.currentStep() === 1) return this.isStep1Valid();
    return this.isStep2Valid() && this.layoutErrors().length === 0;
  });

  ngOnInit() {
    this.luxscaleService.getStandardCategories().subscribe({
      next: (categories) => {
        this.standardCategories.set(categories);
        this.categoriesLoading.set(false);
      },
      error: () => {
        this.standardCategories.set([]);
        this.categoriesLoading.set(false);
      },
    });
  }

  onMetricInput(
    field:
      | 'width1'
      | 'length1'
      | 'width2'
      | 'length2'
      | 'ceilingHeight'
      | 'mountingHeight'
      | 'spacingX'
      | 'spacingY'
      | 'offsetStartX'
      | 'offsetStartY'
      | 'offsetEndMinX'
      | 'offsetEndMinY',
    value: unknown,
  ) {
    this.store.updateTechnical({ [field]: toMetric(value) });
  }

  toggleCustomInstall() {
    this.store.updateTechnical({ customInstall: !this.store.technical().customInstall });
    this.submitError.set('');
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
    this.store.updateTechnical({ standardCategory: value, taskOrActivity: '' });
    this.selectedStandard.set(null);
    this.loadTasks(value);
  }

  onTaskSelect(value: string) {
    this.store.updateTechnical({ taskOrActivity: value });
    this.loadStandardObject(value);
  }

  onSubmit() {
    if (!this.canProceed()) return;

    const standard = this.selectedStandard();
    if (!standard) return;

    const project = this.store.project();
    const tech = this.store.technical();

    const payload: CalculatePayload = {
      sides: [tech.width1!, tech.length1!, tech.width2!, tech.length2!],
      height: tech.mountingHeight!,
      project_info: {
        project_name: project.projectName,
        name: project.clientName,
        company: project.companyName,
        phone: project.clientPhone,
        email: project.clientEmail,
        notes: '',
        mounting_height: tech.mountingHeight!,
        standard_ref_no: standard.ref_no,
        standard_category: tech.standardCategory,
        standard_task_or_activity: standard.task_or_activity,
        standard_lighting: standard,
      },
      standard_ref_no: standard.ref_no,
    };

    const layout = this.buildLayout(tech);
    if (layout) {
      payload.layout = layout;
    }

    this.submitError.set('');
    this.isSubmitting.set(true);
    this.luxscaleService.calculate(payload).subscribe({
      next: (res: unknown) => {
        const response = res as CalculationResponse;
        const usedFallback = applyStandardFallbacks(response, payload.project_info.standard_lighting);
        this.resultStore.setCalculationResult(response, usedFallback, payload);
        this.isSubmitting.set(false);
        this.router.navigate(['/results']);
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.submitError.set(this.messageFromError(err));
      },
    });
  }

  private buildLayout(tech: TechnicalSpecs): LayoutPayload | null {
    if (!tech.customInstall) return null;
    const sx = tech.spacingX;
    const sy = tech.spacingY;
    const hasX = sx != null && sx > 0;
    const hasY = sy != null && sy > 0;
    if (!hasX && !hasY) return null;

    const layout: LayoutPayload = {};
    if (hasX) layout.spacing_x_m = sx;
    if (hasY) layout.spacing_y_m = sy;
    if (tech.offsetStartX != null) layout.offset_start_x_m = tech.offsetStartX;
    if (tech.offsetStartY != null) layout.offset_start_y_m = tech.offsetStartY;
    if (tech.offsetEndMinX != null) layout.offset_end_min_x_m = tech.offsetEndMinX;
    if (tech.offsetEndMinY != null) layout.offset_end_min_y_m = tech.offsetEndMinY;
    return layout;
  }

  private messageFromError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | string | null;
      if (body && typeof body === 'object' && body.message) return body.message;
      if (typeof body === 'string' && body.trim()) return body;
      if (err.status === 400) return 'Invalid layout. Check spacings and offsets.';
    }
    return 'Calculation failed. Try again.';
  }

  private loadTasks(category: string) {
    this.tasksLoading.set(true);
    this.luxscaleService.getTasks(category).subscribe({
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
    const category = this.store.technical().standardCategory;
    this.luxscaleService.getStandardByCategoryAndTaskWithFallback(category, taskWithRef).subscribe({
      next: (entry) => this.selectedStandard.set(entry ?? null),
      error: () => this.selectedStandard.set(null),
    });
  }
}
