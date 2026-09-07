import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CadViewerStore } from './cad-viewer.store';
import { CadLegendComponent } from './components/cad-legend/cad-legend.component';
import { CadPlanComponent } from './components/cad-plan/cad-plan.component';
import { CadUploadComponent } from './components/cad-upload/cad-upload.component';

@Component({
  selector: 'app-cad-study',
  imports: [CadUploadComponent, CadPlanComponent, CadLegendComponent],
  templateUrl: './cad-study.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onDocumentEscape()',
  },
})
export class CadStudyPage implements OnInit {
  protected readonly store = inject(CadViewerStore);
  protected readonly renameName = signal('');

  private readonly resetCancel = viewChild<ElementRef<HTMLButtonElement>>('resetCancel');
  private readonly resetTrigger = viewChild<ElementRef<HTMLButtonElement>>('resetTrigger');

  constructor() {
    effect(() => {
      if (!this.store.resetConfirmOpen()) {
        return;
      }
      const cancel = this.resetCancel();
      if (cancel) {
        untracked(() => queueMicrotask(() => cancel.nativeElement.focus()));
      }
    });
  }

  ngOnInit(): void {
    this.store.checkHealth();
    this.store.restoreSession();
  }

  openRename(): void {
    const id = this.store.selectedRoomId();
    const layout = this.store.currentLayout();
    const room =
      layout?.rooms.find((item) => item.id === id) ??
      layout?.physical_rooms.find((item) => item.id === id);
    this.renameName.set(room?.name || '');
    this.store.openRename();
  }

  onRenameInput(event: Event): void {
    this.renameName.set((event.target as HTMLInputElement).value);
  }

  confirmRename(): void {
    this.store.renameSelectedRoom(this.renameName());
  }

  openResetConfirm(): void {
    this.store.openResetConfirm();
  }

  cancelResetConfirm(): void {
    this.store.cancelResetConfirm();
    queueMicrotask(() => this.resetTrigger()?.nativeElement.focus());
  }

  confirmResetJob(): void {
    this.store.confirmResetJob();
    queueMicrotask(() => this.resetTrigger()?.nativeElement.focus());
  }

  onDocumentEscape(): void {
    if (!this.store.resetConfirmOpen()) {
      return;
    }
    queueMicrotask(() => this.cancelResetConfirm());
  }

  onResetDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelResetConfirm();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const root = event.currentTarget as HTMLElement;
    const focusable = [...root.querySelectorAll<HTMLElement>('button:not([disabled])')];
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
