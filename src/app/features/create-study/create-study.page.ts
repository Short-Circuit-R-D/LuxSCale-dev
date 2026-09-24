import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AutomateApi } from '../../core/automate/apis/automate.api';
import type { AutomateRequestDto } from '../../core/automate/dtos/automate-request.dto';
import { asAutomateErrorBody } from '../../core/automate/dtos/automate-error.dto';
import { StandardsApi } from '../../core/standards/apis/standards.api';
import type { StandardResponseDto } from '../../core/standards/dtos/standards.dto';
import { VariantsApi } from '../../core/variants/apis/variants.api';
import { ResultStoreService } from '../../services/result-store.service';
import { RoomPlanPreviewComponent } from '../../shared/room-plan/room-plan-preview.component';
import { SearchableSelectComponent } from '../../shared/searchable-select/searchable-select.component';
import { createStudyStore } from './stores/study-form.store';

function toMetric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** RxJS `timeout` raises a `TimeoutError`, not an `HttpErrorResponse`. */
function isTimeoutError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: unknown }).name === 'TimeoutError'
  );
}

@Component({
  selector: 'app-create-study',
  imports: [FormsModule, RouterLink, RoomPlanPreviewComponent, SearchableSelectComponent],
  templateUrl: './create-study.page.html',
  styleUrl: './create-study.page.css',
})
export class CreateStudyPage implements OnInit {
  protected readonly store = createStudyStore();
  private readonly automateApi = inject(AutomateApi);
  private readonly standardsApi = inject(StandardsApi);
  private readonly variantsApi = inject(VariantsApi);
  private readonly router = inject(Router);
  private readonly resultStore = inject(ResultStoreService);

  protected readonly standardCategories = signal<string[]>([]);
  protected readonly taskOrActivities = signal<string[]>([]);
  protected readonly selectedStandard = signal<StandardResponseDto | null>(null);
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

  protected readonly heightError = computed(() => {
    const t = this.store.technical();
    if (t.ceilingHeight == null || t.mountingHeight == null) {
      return '';
    }
    if (t.mountingHeight > t.ceilingHeight) {
      return 'Mounting height cannot exceed ceiling height';
    }
    return '';
  });

  protected readonly isStep2Valid = computed(() => {
    const t = this.store.technical();
    return !!(
      t.length !== null &&
      t.length > 0 &&
      t.width !== null &&
      t.width > 0 &&
      t.ceilingHeight !== null &&
      t.ceilingHeight > 0 &&
      t.mountingHeight !== null &&
      t.mountingHeight > 0 &&
      !this.heightError() &&
      t.standardCategory &&
      t.taskOrActivity &&
      this.selectedStandard()
    );
  });

  protected readonly canProceed = computed(() => {
    if (this.store.currentStep() === 1) return this.isStep1Valid();
    return this.isStep2Valid();
  });

  ngOnInit() {
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
  }

  onMetricInput(field: 'length' | 'width' | 'ceilingHeight' | 'mountingHeight', value: unknown) {
    this.store.updateTechnical({ [field]: toMetric(value) });
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
    if (!this.canProceed() || this.isSubmitting()) return;

    const standard = this.selectedStandard();
    if (!standard) return;

    const project = this.store.project();
    const tech = this.store.technical();
    const length = tech.length!;
    const width = tech.width!;

    const request: AutomateRequestDto = {
      polygon: [
        { x: 0, y: 0 },
        { x: length, y: 0 },
        { x: length, y: width },
        { x: 0, y: width },
      ],
      ceilingHeight: tech.ceilingHeight!,
      mountingHeight: tech.mountingHeight!,
      activityId: standard.id,
      variantIds: null,
    };

    this.submitError.set('');
    this.isSubmitting.set(true);
    this.automateApi.automate(request).subscribe({
      next: ({ data, requestId }) => {
        this.resultStore.setStudy({
          request,
          response: data,
          project: {
            projectName: project.projectName,
            companyName: project.companyName,
            clientName: project.clientName,
            clientPhone: project.clientPhone,
            clientEmail: project.clientEmail,
          },
          standard,
          requestId,
        });
        this.variantsApi.getVariantHeaders(data.application).subscribe({
          next: (headers) => this.resultStore.setVariantHeaders(headers),
          error: () => this.resultStore.setVariantHeaders(new Map()),
        });
        this.isSubmitting.set(false);
        this.router.navigate(['/results']);
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.submitError.set(this.messageFromError(err));
      },
    });
  }

  private messageFromError(err: unknown): string {
    if (isTimeoutError(err)) {
      return 'Design run timed out. Runs are expensive, so it was not retried — submit again when ready.';
    }
    if (err instanceof HttpErrorResponse) {
      if (err.error) {
        const body = asAutomateErrorBody(err.error);
        if (body) {
          const details = body.error.details.map((d) => `${d.field}: ${d.issue}`).join(' ');
          return details ? `${body.error.message} ${details}` : body.error.message;
        }
        if (typeof err.error === 'object' && 'message' in err.error) {
          return String((err.error as { message: unknown }).message);
        }
        if (typeof err.error === 'string' && err.error.trim()) {
          return err.error;
        }
      }
      if (err.status === 422) return 'Invalid room or standard. Check dimensions, heights, and activity.';
      if (err.status === 400) return 'Room geometry or catalog has an issue. Check the details and try again.';
    }
    return 'Design failed. Try again.';
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
    const category = this.store.technical().standardCategory;
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
        next: (entry) => this.selectedStandard.set(entry),
        error: () => this.selectedStandard.set(null),
      });
  }
}
