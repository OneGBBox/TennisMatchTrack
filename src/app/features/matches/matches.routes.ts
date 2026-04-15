import { Routes } from '@angular/router';

export const matchesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./match-list/match-list.component').then(m => m.MatchListComponent)
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./new-match/new-match.component').then(m => m.NewMatchComponent)
  },
  {
    path: ':id/score',
    loadComponent: () =>
      import('./scoring/scoring.component').then(m => m.ScoringComponent)
  },
  {
    path: ':id/stats',
    loadComponent: () =>
      import('./match-stats/match-stats.component').then(m => m.MatchStatsComponent)
  }
];
