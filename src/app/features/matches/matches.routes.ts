import { Routes } from '@angular/router';

export const matchesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./match-list/match-list.component').then(m => m.MatchListComponent)
  }
];
