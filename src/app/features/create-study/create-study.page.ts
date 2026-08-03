import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CalculationResponse } from '../../services/calculation-result.service';
import { ResultStoreService } from '../../services/result-store.service';
import { LuxScaleService, StandardEntry } from '../../services/luxscale.service';
import { createStudyStore } from './stores/study-form.store';

@Component({
  selector: 'app-create-study',
  imports: [FormsModule, RouterLink],
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

  protected readonly standardSearch = signal('');
  protected readonly taskSearch = signal('');
  protected readonly showStandardDropdown = signal(false);
  protected readonly showTaskDropdown = signal(false);
  protected readonly isSubmitting = signal(false);

  protected readonly phoneError = signal('');
  protected readonly emailError = signal('');

  protected readonly filteredStandards = computed(() => {
    const search = this.standardSearch().toLowerCase();
    return this.standardCategories().filter((c) => c.toLowerCase().includes(search));
  });

  protected readonly filteredTasks = computed(() => {
    const search = this.taskSearch().toLowerCase();
    return this.taskOrActivities().filter((t) => t.toLowerCase().includes(search));
  });

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

  protected readonly canProceed = computed(() => {
    return this.store.currentStep() === 1 ? this.isStep1Valid() : this.isStep2Valid();
  });

  ngOnInit() {
    this.luxscaleService.getStandardCategories().subscribe({
      next: (categories) => this.standardCategories.set(categories),
      error: () => this.standardCategories.set([]),
    });
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
    this.showStandardDropdown.set(false);
    this.standardSearch.set('');
    this.selectedStandard.set(null);
    this.loadTasks(value);
  }

  onTaskSelect(value: string) {
    this.store.updateTechnical({ taskOrActivity: value });
    this.showTaskDropdown.set(false);
    this.taskSearch.set('');
    this.loadStandardObject(value);
  }

  toggleStandardDropdown() {
    this.showStandardDropdown.update((v) => !v);
    this.showTaskDropdown.set(false);
  }

  toggleTaskDropdown() {
    this.showTaskDropdown.update((v) => !v);
    this.showStandardDropdown.set(false);
  }

  onSubmit() {
    if (!this.canProceed()) return;

    const standard = this.selectedStandard();
    if (!standard) return;

    const project = this.store.project();
    const tech = this.store.technical();

    const payload = {
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

    this.isSubmitting.set(true);
    this.luxscaleService.calculate(payload).subscribe({
      next: (res: unknown) => {
        this.resultStore.setCalculationResult(res as CalculationResponse);
        this.isSubmitting.set(false);
        this.router.navigate(['/results']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error('Calculation failed:', err);
      },
    });
  }

  private loadTasks(category: string) {
    this.luxscaleService.getTasks(category).subscribe({
      next: (tasks) => this.taskOrActivities.set(tasks),
      error: () => this.taskOrActivities.set([]),
    });
  }

  private loadStandardObject(taskWithRef: string) {
    const category = this.store.technical().standardCategory;
    this.luxscaleService.getStandardByCategoryAndTask(category, taskWithRef).subscribe({
      next: (entry) => this.selectedStandard.set(entry ?? null),
      error: () => this.selectedStandard.set(null),
    });
  }
}
