import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CadViewerStore } from '../../cad-viewer.store';
import { CadUnit } from '../../models/cad-unit.model';

const ACCEPTED_EXTENSIONS = new Set(['.dxf', '.dwg']);
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const JOB_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-cad-upload',
  templateUrl: './cad-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CadUploadComponent {
  protected readonly store = inject(CadViewerStore);
  protected readonly unit = signal<CadUnit | ''>('');
  protected readonly dragging = signal(false);
  protected readonly existingJobId = signal('');
  protected readonly selectedFile = signal<File | null>(null);

  protected readonly units: { value: CadUnit | ''; label: string }[] = [
    { value: '', label: 'File default' },
    { value: 'm', label: 'Meters (m)' },
    { value: 'mm', label: 'Millimeters (mm)' },
    { value: 'cm', label: 'Centimeters (cm)' },
    { value: 'in', label: 'Inches (in)' },
    { value: 'ft', label: 'Feet (ft)' },
  ];

  onJobIdInput(event: Event): void {
    this.existingJobId.set((event.target as HTMLInputElement).value.trim());
  }

  submitJobId(): void {
    const jobId = this.existingJobId();
    if (!jobId) {
      this.store.setClientError({
        code: 'VALIDATION_ERROR',
        message: 'Enter a job ID before loading.',
      });
      return;
    }
    if (!JOB_UUID_PATTERN.test(jobId)) {
      this.store.setClientError({
        code: 'VALIDATION_ERROR',
        message: 'Enter a valid job ID (UUID).',
      });
      return;
    }
    this.store.openJob(jobId);
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.selectFile(file);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.store.busy()) {
      return;
    }
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.selectFile(file);
    }
  }

  startUpload(): void {
    const file = this.selectedFile();
    if (!file) {
      this.store.setClientError({
        code: 'VALIDATION_ERROR',
        message: 'Choose a DXF or DWG drawing before analyzing.',
      });
      return;
    }
    const unit = this.unit();
    this.store.upload(file, unit || undefined);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.store.busy()) {
      return;
    }
    this.dragging.set(true);
  }

  onDragLeave(): void {
    this.dragging.set(false);
  }

  onUnitChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.unit.set((value || '') as CadUnit | '');
  }

  private selectFile(file: File): void {
    const ext = this.extension(file.name);
    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      this.selectedFile.set(null);
      this.store.setClientError({
        code: 'UNSUPPORTED_FORMAT',
        message: 'This file type is not supported. Upload a DXF or DWG drawing.',
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.selectedFile.set(null);
      this.store.setClientError({
        code: 'FILE_TOO_LARGE',
        message: 'The file exceeds the 50 MB limit. Choose a smaller drawing.',
      });
      return;
    }
    this.store.clearError();
    this.selectedFile.set(file);
  }

  private extension(name: string): string {
    const index = name.lastIndexOf('.');
    return index >= 0 ? name.slice(index).toLowerCase() : '';
  }
}
