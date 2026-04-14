import { Routes } from '@angular/router';

export const playersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./player-list/player-list.component').then(m => m.PlayerListComponent)
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./player-edit/player-edit.component').then(m => m.PlayerEditComponent)
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./player-edit/player-edit.component').then(m => m.PlayerEditComponent)
  }
];
