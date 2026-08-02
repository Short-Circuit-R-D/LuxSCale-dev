import { Component, signal } from '@angular/core';

interface SystemStep {
  id: string;
  title: string;
  active: boolean;
}

@Component({
  selector: 'app-features',
  templateUrl: './features.component.html',
  styleUrl: './features.component.css',
})
export class FeaturesComponent {
  protected readonly steps = signal<SystemStep[]>([
    { id: 'SYSTEM_01', title: 'Project & Space Definition', active: true },
    { id: 'SYSTEM_02', title: 'Automated Layout Calculations', active: true },
    { id: 'SYSTEM_03', title: 'Report & CAD Export', active: true },
  ]);
}
