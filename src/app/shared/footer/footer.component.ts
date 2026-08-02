import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FooterLink {
  label: string;
  href: string;
}

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  protected readonly footerLinks = signal<FooterLink[]>([
    { label: 'Documentation', href: '#' },
    { label: 'API Reference', href: '#' },
    { label: 'System Status', href: '#' },
    { label: 'Terms of Service', href: '#' },
  ]);
}
