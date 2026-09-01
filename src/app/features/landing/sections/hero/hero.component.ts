import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeStudyMenu()',
    '(document:keydown.escape)': 'closeStudyMenu()',
  },
})
export class HeroComponent {
  protected readonly studyMenuOpen = signal(false);

  protected toggleStudyMenu(event: Event): void {
    event.stopPropagation();
    this.studyMenuOpen.update((open) => !open);
  }

  protected closeStudyMenu(): void {
    this.studyMenuOpen.set(false);
  }
}
