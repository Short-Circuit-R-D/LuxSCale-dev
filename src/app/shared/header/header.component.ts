import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface NavItem {
  label: string;
  href: string;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  protected readonly navItems = signal<NavItem[]>([
    { label: 'Features', href: '#features' },
    { label: 'Usage', href: '#usage' },
    { label: 'Principles', href: '#principles' },
  ]);

  protected readonly mobileMenuOpen = signal(false);

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
