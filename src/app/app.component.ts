import { Component, OnInit, inject, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { BottomTabBarComponent } from './shared/components/bottom-tab-bar/bottom-tab-bar.component';
import { ReplicationService } from './core/services/replication.service';
import { DatabaseService } from './core/services/database.service';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BottomTabBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly replication = inject(ReplicationService);
  private readonly dbService   = inject(DatabaseService);
  private readonly auth        = inject(AuthService);
  private readonly router      = inject(Router);

  constructor() {
    // Re-start sync whenever the user signs in; stop it when they sign out
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.replication.startReplication().catch(err =>
          console.warn('[App] Sync start failed:', err)
        );
      } else if (!this.auth.isLoading()) {
        this.replication.stopReplication();
      }
    });
  }

  /** Hide the tab bar on auth screens (/auth/*) */
  private readonly url$ = this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(e => (e as NavigationEnd).urlAfterRedirects),
    startWith(this.router.url)
  );
  readonly showTabBar = toSignal(
    this.url$.pipe(map(url => !url.startsWith('/auth'))),
    { initialValue: true }
  );

  ngOnInit(): void {
    // Restore saved theme preference
    const saved = localStorage.getItem('tennis-theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // Run DB smoke-test on every startup — results visible in DevTools console
    this.dbService.testDb();

    // Kick off background sync — non-blocking, safe to fail offline
    this.replication.init().catch(err =>
      console.warn('[App] Replication init failed (offline?):', err)
    );
  }
}
