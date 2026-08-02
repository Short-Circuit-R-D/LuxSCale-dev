import { Component, signal } from '@angular/core';

interface Principle {
  number: string;
  tag: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-principles',
  templateUrl: './principles.component.html',
  styleUrl: './principles.component.css',
})
export class PrinciplesComponent {
  protected readonly principles = signal<Principle[]>([
    {
      number: '01',
      tag: 'Model',
      title: 'EN 12464-1 Accuracy',
      description:
        'Built directly on European workplace standards. Automatically maps illuminance (Em), uniformity (Uo), and glare (GRl) target parameters.',
    },
    {
      number: '02',
      tag: 'Audit',
      title: 'Photometric Auditing',
      description:
        'Full transparency on layout performance, fixture spacing grids, and lumen outputs — ensuring zero compliance oversights before installation.',
    },
    {
      number: '03',
      tag: 'Flow',
      title: 'Instant Handover',
      description:
        'Go from room dimensions to ready-to-use DXF exports and full PDF engineering reports.',
    },
  ]);
}
