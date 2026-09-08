import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ResultsViewComponent } from '../results/results-view.component';
import { CadActiveTab, CadRoomStudyDraft, CadViewerStore } from './cad-viewer.store';
import { CadLegendComponent } from './components/cad-legend/cad-legend.component';
import { CadPlanComponent } from './components/cad-plan/cad-plan.component';
import { CadUploadComponent } from './components/cad-upload/cad-upload.component';
import { RoomStudyDialogComponent } from './components/room-study-dialog/room-study-dialog.component';

@Component({
  selector: 'app-cad-study',
  imports: [
    CadUploadComponent,
    CadPlanComponent,
    CadLegendComponent,
    RoomStudyDialogComponent,
    ResultsViewComponent,
  ],
  templateUrl: './cad-study.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onDocumentEscape()',
  },
})
export class CadStudyPage implements OnInit {
  protected readonly store = inject(CadViewerStore);
  protected readonly renameName = signal('');
  protected readonly activeStudy = computed(() => {
    const tab = this.store.activeTab();
    if (tab === 'analysis') {
      return null;
    }
    return this.store.roomStudies().find((study) => study.id === tab) ?? null;
  });

  private readonly resetCancel = viewChild<ElementRef<HTMLButtonElement>>('resetCancel');
  private readonly resetTrigger = viewChild<ElementRef<HTMLButtonElement>>('resetTrigger');
  private readonly studyTrigger = viewChild<ElementRef<HTMLButtonElement>>('studyTrigger');

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
    this.renameName.set(this.store.selectedRoom()?.name || '');
    this.store.openRename();
  }

  onRenameInput(event: Event): void {
    this.renameName.set((event.target as HTMLInputElement).value);
  }

  confirmRename(): void {
    this.store.renameSelectedRoom(this.renameName());
  }

  openRoomStudy(): void {
    this.store.openRoomStudy();
  }

  onRoomStudyClosed(): void {
    this.store.cancelRoomStudy();
    queueMicrotask(() => this.studyTrigger()?.nativeElement.focus());
  }

  onRoomStudyCompleted(draft: CadRoomStudyDraft): void {
    const id = this.store.addRoomStudy(draft);
    this.focusTab(id);
  }

  selectTab(tab: CadActiveTab): void {
    this.store.selectTab(tab);
    this.focusTab(tab);
  }

  closeStudy(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const wasActive = this.store.activeTab() === id;
    this.store.closeRoomStudy(id);
    if (wasActive) {
      this.focusTab('analysis');
    }
  }

  onTabListKeydown(event: KeyboardEvent): void {
    if ((event.target as HTMLElement).getAttribute('role') !== 'tab') {
      return;
    }
    const ids: CadActiveTab[] = ['analysis', ...this.store.roomStudies().map((study) => study.id)];
    const index = ids.indexOf(this.store.activeTab());
    if (index < 0) {
      return;
    }
    let next = index;
    if (event.key === 'ArrowRight') {
      next = (index + 1) % ids.length;
    } else if (event.key === 'ArrowLeft') {
      next = (index - 1 + ids.length) % ids.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = ids.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    this.selectTab(ids[next]);
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
    if (this.store.roomStudyOpen()) {
      queueMicrotask(() => this.onRoomStudyClosed());
      return;
    }
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

  private focusTab(tab: CadActiveTab): void {
    queueMicrotask(() => document.getElementById(`cad-tab-${tab}`)?.focus());
  }
}
