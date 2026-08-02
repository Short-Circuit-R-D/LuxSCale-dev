import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface NavItem {
  label: string;
  href: string;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  template: `
    <header class="fixed top-0 left-0 right-0 z-50 border-b border-[#2B2B2B] bg-[#000000]/80 backdrop-blur-md">
      <div class="mx-auto flex max-w-[1440px] items-center justify-between px-12 py-4">
        <a routerLink="/" class="font-display text-xl tracking-wide text-white uppercase">
          LuxScale AI
        </a>
        <nav class="flex items-center gap-8">
          @for (item of navItems(); track item.href) {
            <a
              [href]="item.href"
              class="text-sm text-[#B8B8B8] transition-colors duration-180 hover:text-white"
            >
              {{ item.label }}
            </a>
          }
          <a
            href="#"
            class="rounded-xl bg-[#EB1B26] px-6 py-3 text-sm font-medium text-white transition-colors duration-180 hover:bg-[#A80F18]"
          >
            Get Started
          </a>
        </nav>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  protected readonly navItems = signal<NavItem[]>([
    { label: 'Features', href: '#features' },
    { label: 'Usage', href: '#usage' },
    { label: 'Principles', href: '#principles' },
  ]);
}
