import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'matches',
    loadChildren: () =>
      import('./features/matches/matches.routes').then(m => m.matchesRoutes)
  },
  {
    path: 'players',
    loadChildren: () =>
      import('./features/players/players.routes').then(m => m.playersRoutes)
  },
  {
    path: '',
    redirectTo: 'matches',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'matches'
  }
];
