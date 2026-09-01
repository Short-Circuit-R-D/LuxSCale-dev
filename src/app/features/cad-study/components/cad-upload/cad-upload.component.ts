import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CadViewerStore } from '../../cad-viewer.store';
import { CadUnit } from '../../models/cad-unit.model';

const ACCEPTED_EXTENSIONS = new Set(['.dxf', '.dwg']);
const MAX_FILE_BYTES = 50 * 1024 * 1024;

@Component({
  selector: 'app-cad-upload',
  templateUrl: './cad-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CadUploadComponent {
  protected readonly store = inject(CadViewerStore);
  protected readonly unit = signal<CadUnit | ''>('');
  protected readonly dragging = signal(false);
  protected readonly r2Url = signal('');

  protected readonly units: { value: CadUnit | ''; label: string }[] = [
    { value: '', label: 'File default' },
    { value: 'm', label: 'Meters (m)' },
    { value: 'mm', label: 'Millimeters (mm)' },
    { value: 'cm', label: 'Centimeters (cm)' },
    { value: 'in', label: 'Inches (in)' },
    { value: 'ft', label: 'Feet (ft)' },
  ];

  onR2Input(event: Event): void {
    this.r2Url.set((event.target as HTMLInputElement).value.trim());
  }

  submitR2(): void {
    const url = this.r2Url();
    if (!url) {
      this.store.setClientError({
        code: 'VALIDATION_ERROR',
        message: 'Paste an R2 URL before analyzing.',
      });
      return;
    }
    const unit = this.unit();
    this.store.uploadFromR2(url, unit || undefined);
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.submitFile(file);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.submitFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(): void {
    this.dragging.set(false);
  }

  onUnitChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.unit.set((value || '') as CadUnit | '');
  }

  private submitFile(file: File): void {
    const ext = this.extension(file.name);
    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      this.store.setClientError({
        code: 'UNSUPPORTED_FORMAT',
        message: 'This file type is not supported. Upload a DXF or DWG drawing.',
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.store.setClientError({
        code: 'FILE_TOO_LARGE',
        message: 'The file exceeds the 50 MB limit. Choose a smaller drawing.',
      });
      return;
    }
    const unit = this.unit();
    this.store.upload(file, unit || undefined);
  }

  private extension(name: string): string {
    const index = name.lastIndexOf('.');
    return index >= 0 ? name.slice(index).toLowerCase() : '';
  }
}
