import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'matches',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/matches/matches.routes').then(m => m.matchesRoutes)
  },
  {
    path: 'players',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/players/players.routes').then(m => m.playersRoutes)
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.authRoutes)
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
