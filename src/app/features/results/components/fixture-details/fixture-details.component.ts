import { Component, input, signal } from '@angular/core';
import { FixtureResult } from '../../../../services/result-store.service';
import { IesAnalysisComponent } from '../ies-analysis/ies-analysis.component';

@Component({
  selector: 'app-fixture-details',
  imports: [IesAnalysisComponent],
  templateUrl: './fixture-details.component.html',
  styleUrl: './fixture-details.component.css',
})
export class FixtureDetailsComponent {
  fixtureResult = input.required<FixtureResult>();

  protected readonly selectedImageIndex = signal(0);
  protected readonly isZoomed = signal(false);
  protected readonly zoomPosition = signal({ x: 50, y: 50 });

  get images(): string[] {
    const fr = this.fixtureResult();
    if (!fr || fr.fixtures.length === 0) return [];
    return fr.fixtures[0].product.images;
  }

  get product() {
    const fr = this.fixtureResult();
    if (!fr || fr.fixtures.length === 0) return null;
    return fr.fixtures[0].product;
  }

  get fixture() {
    const fr = this.fixtureResult();
    if (!fr || fr.fixtures.length === 0) return null;
    return fr.fixtures[0];
  }

  selectImage(index: number) {
    this.selectedImageIndex.set(index);
  }

  nextImage() {
    const len = this.images.length;
    if (len === 0) return;
    this.selectedImageIndex.set((this.selectedImageIndex() + 1) % len);
  }

  prevImage() {
    const len = this.images.length;
    if (len === 0) return;
    this.selectedImageIndex.set((this.selectedImageIndex() - 1 + len) % len);
  }

  toggleZoom() {
    this.isZoomed.update((v) => !v);
  }

  onZoomMove(event: MouseEvent) {
    if (!this.isZoomed()) return;
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    this.zoomPosition.set({ x, y });
  }

  closeZoom() {
    this.isZoomed.set(false);
  }
}
