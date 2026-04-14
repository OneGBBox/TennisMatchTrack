import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BottomTabBarComponent } from './shared/components/bottom-tab-bar/bottom-tab-bar.component';
import { ReplicationService } from './core/services/replication.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BottomTabBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly replication = inject(ReplicationService);

  ngOnInit(): void {
    // Kick off background sync — non-blocking, safe to fail offline
    this.replication.init().catch(err =>
      console.warn('[App] Replication init failed (offline?):', err)
    );
  }
}
