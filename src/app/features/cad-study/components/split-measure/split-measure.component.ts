import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CadViewerStore } from '../../cad-viewer.store';
import type { SplitAxis, SplitEdge, SplitMeasure } from '../../cad-geometry';

export interface SplitCommit {
  axis: SplitAxis;
  edge: SplitEdge;
  distance: number;
}

/** Exact-number split panel: cut a room wall-to-wall at a typed offset from an edge. */
@Component({
  selector: 'app-split-measure',
  imports: [FormsModule],
  templateUrl: './split-measure.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplitMeasureComponent {
  private readonly store = inject(CadViewerStore);

  readonly measure = input.required<SplitMeasure>();
  readonly commit = output<SplitCommit>();

  protected readonly busy = this.store.busy;
  protected readonly storeError = this.store.splitError;

  protected readonly axis = signal<SplitAxis>('horizontal');
  protected readonly edge = signal<SplitEdge>('min');
  protected readonly distance = signal<number | null>(null);
  protected readonly localError = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.axis.set(this.measure().axis);
      this.edge.set('min');
      this.distance.set(null);
      this.localError.set(null);
      this.store.clearSplitError();
    });
  }

  protected readonly minEdgeLabel = (): string =>
    this.axis() === 'horizontal' ? 'South edge' : 'West edge';

  protected readonly maxEdgeLabel = (): string =>
    this.axis() === 'horizontal' ? 'North edge' : 'East edge';

  protected readonly readout = (): string => {
    const measure = this.measure();
    const direction = measure.axis === 'horizontal' ? 'Horizontal cut' : 'Vertical cut';
    const from = measure.axis === 'horizontal' ? 'south edge' : 'west edge';
    const to = measure.axis === 'horizontal' ? 'north edge' : 'east edge';
    return `${direction} · ${measure.fromMin.toFixed(2)} m from ${from} · ${measure.toMax.toFixed(2)} m to ${to} · span ${measure.span.toFixed(2)} m`;
  };

  protected onDistanceInput(value: unknown): void {
    const parsed = typeof value === 'number' ? value : Number(value);
    this.distance.set(value === null || value === undefined || value === '' ? null : parsed);
    this.localError.set(null);
    this.store.clearSplitError();
  }

  protected setAxis(axis: SplitAxis): void {
    this.axis.set(axis);
    this.localError.set(null);
    this.store.clearSplitError();
  }

  protected setEdge(edge: SplitEdge): void {
    this.edge.set(edge);
    this.localError.set(null);
    this.store.clearSplitError();
  }

  protected apply(): void {
    const distance = this.distance();
    if (distance == null || !Number.isFinite(distance)) {
      this.localError.set('Enter a distance in meters.');
      return;
    }
    this.localError.set(null);
    this.commit.emit({ axis: this.axis(), edge: this.edge(), distance });
  }
}
