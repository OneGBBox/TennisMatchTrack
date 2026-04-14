import { Routes } from '@angular/router';

export const playersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./player-list/player-list.component').then(m => m.PlayerListComponent)
  }
];
