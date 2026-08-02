import { Component, signal } from '@angular/core';

interface Capability {
  label: string;
  title: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-capabilities',
  templateUrl: './capabilities.component.html',
  styleUrl: './capabilities.component.css',
})
export class CapabilitiesComponent {
  protected readonly capabilities = signal<Capability[]>([
    {
      label: 'Photometric Matrix Engine',
      title: 'Photometric Matrix Engine',
      description:
        'Automated reflectance factor calculations and illuminance grid simulations optimized for complex room geometries.',
      icon: 'grid',
    },
    {
      label: 'Luminaire Optimization',
      title: 'Luminaire Optimization',
      description:
        'Intelligent fixture selection comparing power consumption (W/m\u00B2), luminous efficiency, and target mounting heights.',
      icon: 'lightbulb',
    },
    {
      label: 'Compliance Verification',
      title: 'Compliance Verification',
      description:
        'Automated failure state flagging when room optics fall below uniform thresholds or exceed standard glare ratings.',
      icon: 'shield',
    },
  ]);
}
