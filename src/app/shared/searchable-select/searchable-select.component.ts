import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

let nextSelectId = 0;

@Component({
  selector: 'app-searchable-select',
  imports: [FormsModule],
  templateUrl: './searchable-select.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class SearchableSelectComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly generatedId = `searchable-select-${++nextSelectId}`;

  readonly label = input.required<string>();
  readonly placeholder = input('Select');
  readonly options = input<readonly string[]>([]);
  readonly value = input('');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly emptyText = input('No results found');
  readonly controlId = input('');
  readonly valueChange = output<string>();

  protected readonly open = signal(false);
  protected readonly search = signal('');

  protected readonly fieldId = computed(() => this.controlId() || this.generatedId);

  protected readonly filtered = computed(() => {
    const query = this.search().toLowerCase();
    return this.options().filter((option) => option.toLowerCase().includes(query));
  });

  toggle(): void {
    if (this.disabled()) {
      return;
    }
    this.open.update((open) => !open);
    if (!this.open()) {
      this.search.set('');
    }
  }

  select(value: string): void {
    this.valueChange.emit(value);
    this.open.set(false);
    this.search.set('');
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
      this.search.set('');
    }
  }
}
