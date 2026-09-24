import { Component, computed, inject, input, signal } from '@angular/core';
import { AssetsApi } from '../../../../core/assets/apis/assets.api';
import type { VariantDetailResponseDto } from '../../../../core/variants/dtos/variants.dto';

@Component({
  selector: 'app-fixture-details',
  templateUrl: './fixture-details.component.html',
  styleUrl: './fixture-details.component.css',
})
export class FixtureDetailsComponent {
  private readonly assetsApi = inject(AssetsApi);

  variant = input<VariantDetailResponseDto | null>(null);

  protected readonly selectedImageIndex = signal(0);
  protected readonly isZoomed = signal(false);
  protected readonly zoomPosition = signal({ x: 50, y: 50 });

  protected readonly images = computed(() => {
    const variant = this.variant();
    if (!variant) return [];
    return variant.images.map((image) => ({
      url: this.assetsApi.assetUrl(image.image_file_id),
      alt: image.image_file.original_filename,
    }));
  });

  protected lumens(): string {
    const variant = this.variant();
    if (!variant) return '—';
    return Math.round(variant.power * variant.efficacy).toLocaleString('en-US');
  }

  protected dimensions(): string {
    const variant = this.variant();
    if (!variant) return '—';
    const parts: string[] = [];
    const push = (label: string, value: string | null) => {
      if (value != null) parts.push(`${label} ${value} mm`);
    };
    push('L', variant.dimension_length);
    push('W', variant.dimension_width);
    push('D', variant.dimension_depth);
    push('R', variant.dimension_radius);
    return parts.length > 0 ? parts.join(' · ') : '—';
  }

  selectImage(index: number) {
    this.selectedImageIndex.set(index);
  }

  nextImage() {
    const len = this.images().length;
    if (len === 0) return;
    this.selectedImageIndex.set((this.selectedImageIndex() + 1) % len);
  }

  prevImage() {
    const len = this.images().length;
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
