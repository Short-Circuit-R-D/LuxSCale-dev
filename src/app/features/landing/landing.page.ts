import { Component } from '@angular/core';
import { HeroComponent } from './sections/hero/hero.component';
import { PrinciplesComponent } from './sections/principles/principles.component';
import { FeaturesComponent } from './sections/features/features.component';
import { CapabilitiesComponent } from './sections/capabilities/capabilities.component';

@Component({
  selector: 'app-landing',
  imports: [HeroComponent, PrinciplesComponent, FeaturesComponent, CapabilitiesComponent],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.css',
})
export class LandingPage {}
