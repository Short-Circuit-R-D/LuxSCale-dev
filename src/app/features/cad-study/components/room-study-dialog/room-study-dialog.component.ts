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
import { applyStandardFallbacks } from '../../../../services/calculation-result.service';
import { LuxScaleService, StandardEntry } from '../../../../services/luxscale.service';
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

function standardRefFromTask(taskWithRef: string): string | null {
  return taskWithRef.match(/\(([^)]+)\)$/)?.[1] ?? null;
}

function messageFromError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { message?: string } | string | null;
    if (body && typeof body === 'object' && body.message) return body.message;
    if (typeof body === 'string' && body.trim()) return body;
  }
  return 'Calculation failed. Try again.';
}

@Component({
  selector: 'app-room-study-dialog',
  imports: [FormsModule, RoomPlanPreviewComponent, SearchableSelectComponent],
  templateUrl: './room-study-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomStudyDialogComponent {
  private readonly luxscaleService = inject(LuxScaleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  readonly room = input.required<Room>();
  readonly closed = output<void>();
  readonly completed = output<CadRoomStudyDraft>();

  protected readonly mountingHeight = signal<number | null>(null);
  protected readonly standardCategory = signal('');
  protected readonly taskOrActivity = signal('');
  protected readonly selectedStandard = signal<StandardEntry | null>(null);
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

  protected readonly canBegin = computed(() => {
    const height = this.mountingHeight();
    return (
      height != null &&
      height > 0 &&
      !!standardRefFromTask(this.taskOrActivity()) &&
      this.localShape().vertices.length >= 3 &&
      !this.submitting()
    );
  });

  constructor() {
    afterNextRender(() => this.closeBtn()?.nativeElement.focus());
    this.luxscaleService.getStandardCategories().pipe(takeUntilDestroyed()).subscribe({
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

  onHeightInput(value: unknown): void {
    this.mountingHeight.set(toMetric(value));
  }

  onStandardSelect(value: string): void {
    this.standardCategory.set(value);
    this.taskOrActivity.set('');
    this.selectedStandard.set(null);
    this.tasks.set([]);
    this.tasksLoading.set(true);
    this.luxscaleService.getTasks(value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.luxscaleService
      .getStandardByCategoryAndTaskWithFallback(this.standardCategory(), value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entry) => this.selectedStandard.set(entry ?? null),
        error: () => this.selectedStandard.set(null),
      });
  }

  beginStudy(): void {
    const height = this.mountingHeight();
    const standardRef = standardRefFromTask(this.taskOrActivity());
    const shape = this.localShape();
    if (height == null || height <= 0 || !standardRef || shape.vertices.length < 3 || this.submitting()) {
      return;
    }
    this.submitError.set('');
    this.submitting.set(true);
    this.luxscaleService
      .calculateCad({
        polygon: { vertices: shape.vertices.map((point): [number, number] => [point.x, point.y]) },
        height,
        standard_ref_no: standardRef,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const fallbackFields = applyStandardFallbacks(response, this.selectedStandard());
          this.submitting.set(false);
          this.completed.emit({
            title: this.title(),
            roomId: this.room().id,
            result: response,
            fallbackFields,
            vertices: [...shape.vertices],
            holes: shape.holes.map((hole) => [...hole]),
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
