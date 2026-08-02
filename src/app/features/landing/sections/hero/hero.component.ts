import { Component, signal } from '@angular/core';

interface HeroAction {
  label: string;
  href: string;
  primary: boolean;
}

@Component({
  selector: 'app-hero',
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css',
})
export class HeroComponent {
  protected readonly actions = signal<HeroAction[]>([
    { label: 'Start New Study', href: '#', primary: true },
    { label: 'View Last Study', href: '#', primary: false },
  ]);
}
