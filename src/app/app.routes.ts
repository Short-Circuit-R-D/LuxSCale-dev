import { Routes } from '@angular/router';
import { LandingPage } from './features/landing/landing.page';

export const routes: Routes = [
  { path: '', component: LandingPage, title: 'LuxSCale AI' },
  {
    path: 'create-study',
    title: 'Create Study | LuxSCale AI',
    loadComponent: () =>
      import('./features/create-study/create-study.page').then((m) => m.CreateStudyPage),
  },
  {
    path: 'results',
    title: 'Results | LuxSCale AI',
    loadComponent: () => import('./features/results/results.page').then((m) => m.ResultsPage),
  },
];
