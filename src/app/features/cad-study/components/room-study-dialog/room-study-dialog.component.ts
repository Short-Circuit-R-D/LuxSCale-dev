import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { AutomateApi } from '../../../../core/automate/apis/automate.api';
import type { AutomateRequestDto } from '../../../../core/automate/dtos/automate-request.dto';
import { asAutomateErrorBody } from '../../../../core/automate/dtos/automate-error.dto';
import { StandardsApi } from '../../../../core/standards/apis/standards.api';
import type { StandardResponseDto } from '../../../../core/standards/dtos/standards.dto';
import { VariantsApi } from '../../../../core/variants/apis/variants.api';
import { RoomPlanPreviewComponent } from '../../../../shared/room-plan/room-plan-preview.component';
import { localMeterPolygon } from '../../../../shared/room-plan/room-polygon';
import { SearchableSelectComponent } from '../../../../shared/searchable-select/searchable-select.component';
import { CadRoomStudyDraft } from '../../cad-viewer.store';
import { roomPolygon } from '../../cad-geometry';
import { Room } from '../../models/room.model';

function toMetric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function standardIdFromTask(
  standards: StandardResponseDto[],
  taskWithRef: string,
): StandardResponseDto | null {
  const refNo = taskWithRef.match(/\(([^)]+)\)$/)?.[1];
  return standards.find((entry) => entry.hierarchy.ref_number === refNo) ?? null;
}

function messageFromError(err: unknown): string {
  if (isTimeoutError(err)) {
    return 'Design run timed out. Runs are expensive, so it was not retried — begin again when ready.';
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
  }
  return 'Design failed. Try again.';
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
  selector: 'app-room-study-dialog',
  imports: [FormsModule, RoomPlanPreviewComponent, SearchableSelectComponent],
  templateUrl: './room-study-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomStudyDialogComponent {
  private readonly automateApi = inject(AutomateApi);
  private readonly standardsApi = inject(StandardsApi);
  private readonly variantsApi = inject(VariantsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  readonly room = input.required<Room>();
  readonly closed = output<void>();
  readonly completed = output<CadRoomStudyDraft>();

  protected readonly ceilingHeight = signal<number | null>(null);
  protected readonly mountingHeight = signal<number | null>(null);
  protected readonly standardCategory = signal('');
  protected readonly taskOrActivity = signal('');
  protected readonly selectedStandard = signal<StandardResponseDto | null>(null);
  protected readonly standardCategories = signal<string[]>([]);
  protected readonly tasks = signal<string[]>([]);
  protected readonly categoriesLoading = signal(true);
  protected readonly tasksLoading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal('');

  protected readonly localShape = computed(() => {
    const polygon = roomPolygon(this.room());
    return localMeterPolygon(polygon.vertices, polygon.holes ?? []);
  });

  protected readonly title = computed(() => {
    const room = this.room();
    const name = room.name || room.kind || room.id;
    return `${name}'s study`;
  });

  protected readonly heightError = computed(() => {
    const ceiling = this.ceilingHeight();
    const mounting = this.mountingHeight();
    if (ceiling == null || mounting == null) {
      return '';
    }
    if (mounting > ceiling) {
      return 'Mounting height cannot exceed ceiling height';
    }
    return '';
  });

  protected readonly canBegin = computed(() => {
    const ceiling = this.ceilingHeight();
    const height = this.mountingHeight();
    return (
      ceiling != null &&
      ceiling > 0 &&
      height != null &&
      height > 0 &&
      !this.heightError() &&
      !!this.taskOrActivity() &&
      !!this.selectedStandard() &&
      this.localShape().vertices.length >= 3 &&
      !this.submitting()
    );
  });

  constructor() {
    afterNextRender(() => this.closeBtn()?.nativeElement.focus());
    this.standardsApi
      .listCategories()
      .pipe(
        takeUntilDestroyed(),
        map((res) => res.data.map((c) => `${c.category_table_number} – ${c.category_title}`)),
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

  onCeilingInput(value: unknown): void {
    this.ceilingHeight.set(toMetric(value));
  }

  onHeightInput(value: unknown): void {
    this.mountingHeight.set(toMetric(value));
  }

  onStandardSelect(value: string): void {
    this.standardCategory.set(value);
    this.taskOrActivity.set('');
    this.selectedStandard.set(null);
    this.tasks.set([]);
    this.tasksLoading.set(true);
    const tableNumber = value.split(' – ')[0]?.trim() ?? value;
    this.standardsApi
      .listStandards({ category_table_number: tableNumber, limit: 100 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((res) => res.data.map((entry) => `${entry.activity} (${entry.hierarchy.ref_number})`)),
      )
      .subscribe({
        next: (tasks) => {
          this.tasks.set(tasks);
          this.tasksLoading.set(false);
        },
        error: () => {
          this.tasks.set([]);
          this.tasksLoading.set(false);
        },
      });
  }

  onTaskSelect(value: string): void {
    this.taskOrActivity.set(value);
    this.selectedStandard.set(null);
    const tableNumber = this.standardCategory().split(' – ')[0]?.trim() ?? this.standardCategory();
    this.standardsApi
      .listStandards({ category_table_number: tableNumber, limit: 100 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((res) => standardIdFromTask(res.data, value)),
      )
      .subscribe({
        next: (entry) => this.selectedStandard.set(entry),
        error: () => this.selectedStandard.set(null),
      });
  }

  beginStudy(): void {
    const ceiling = this.ceilingHeight();
    const height = this.mountingHeight();
    const standard = this.selectedStandard();
    const shape = this.localShape();
    if (
      ceiling == null ||
      ceiling <= 0 ||
      height == null ||
      height <= 0 ||
      height > ceiling ||
      !standard ||
      shape.vertices.length < 3 ||
      this.submitting()
    ) {
      return;
    }
    const request: AutomateRequestDto = {
      polygon: shape.vertices.map((point) => ({ x: point.x, y: point.y })),
      ceilingHeight: ceiling,
      mountingHeight: height,
      activityId: standard.id,
      variantIds: null,
    };
    this.submitError.set('');
    this.submitting.set(true);
    this.automateApi
      .automate(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data, requestId }) => {
          this.variantsApi.getVariantHeaders(data.application).subscribe({
            next: (headers) => {
              this.submitting.set(false);
              this.completed.emit({
                title: this.title(),
                roomId: this.room().id,
                request,
                response: data,
                project: null,
                standard,
                requestId,
                variantHeaders: headers,
                vertices: [...shape.vertices],
                holes: shape.holes.map((hole) => [...hole]),
              });
            },
            error: () => {
              this.submitting.set(false);
              this.completed.emit({
                title: this.title(),
                roomId: this.room().id,
                request,
                response: data,
                project: null,
                standard,
                requestId,
                variantHeaders: new Map(),
                vertices: [...shape.vertices],
                holes: shape.holes.map((hole) => [...hole]),
              });
            },
          });
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.submitError.set(messageFromError(err));
        },
      });
  }

  cancel(): void {
    this.closed.emit();
  }

  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const root = event.currentTarget as HTMLElement;
    const focusable = [
      ...root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
