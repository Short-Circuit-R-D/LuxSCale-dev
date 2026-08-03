import { Routes } from '@angular/router';
import { LandingPage } from './features/landing/landing.page';

export const routes: Routes = [
  { path: '', component: LandingPage },
  {
    path: 'create-study',
    loadComponent: () =>
      import('./features/create-study/create-study.page').then((m) => m.CreateStudyPage),
  },
  {
    path: 'results',
    loadComponent: () =>
      import('./features/results/results.page').then((m) => m.ResultsPage),
  },
];
