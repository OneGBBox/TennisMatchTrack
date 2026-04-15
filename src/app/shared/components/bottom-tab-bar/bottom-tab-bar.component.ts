import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-tab-bar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-tab-bar.component.html',
  styleUrl: './bottom-tab-bar.component.css'
})
export class BottomTabBarComponent {
  private readonly router = inject(Router);

  get activeTab(): 'matches' | 'players' | 'settings' {
    if (this.router.url.startsWith('/players'))  return 'players';
    if (this.router.url.startsWith('/settings')) return 'settings';
    return 'matches';
  }
}
