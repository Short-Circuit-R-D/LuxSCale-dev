import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface HeroAction {
  label: string;
  href: string;
  primary: boolean;
}

@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css',
})
export class HeroComponent {
  protected readonly actions = signal<HeroAction[]>([
    { label: 'Start New Study', href: '/create-study', primary: true },
    { label: 'View Last Study', href: '#', primary: false },
  ]);
}
