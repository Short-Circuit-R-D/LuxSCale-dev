import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FooterLink {
  label: string;
  href: string;
}

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer class="border-t border-[#2B2B2B] bg-[#000000]">
      <div class="mx-auto flex max-w-[1440px] items-center justify-between px-12 py-8">
        <div class="flex flex-col gap-2">
          <a routerLink="/" class="font-display text-xl tracking-wide text-white uppercase">
            LuxScale AI
          </a>
          <p class="text-xs text-[#7A7A7A]">
            &copy; 2024 LuxScale AI. Engineered Precision.
          </p>
        </div>
        <nav class="flex items-center gap-8">
          @for (link of footerLinks(); track link.href) {
            <a
              [href]="link.href"
              class="text-sm text-[#B8B8B8] transition-colors duration-180 hover:text-white"
            >
              {{ link.label }}
            </a>
          }
        </nav>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  protected readonly footerLinks = signal<FooterLink[]>([
    { label: 'Documentation', href: '#' },
    { label: 'API Reference', href: '#' },
    { label: 'System Status', href: '#' },
    { label: 'Terms of Service', href: '#' },
  ]);
}
