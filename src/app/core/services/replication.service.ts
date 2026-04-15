import { Injectable, OnDestroy, inject } from '@angular/core';
import { SupabaseReplication } from 'rxdb-supabase';
import { RxReplicationState } from 'rxdb/plugins/replication';

import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { Player } from '../models/player.model';
import { Match } from '../models/match.model';

@Injectable({ providedIn: 'root' })
export class ReplicationService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly db   = inject(DatabaseService);

  private playerReplication: RxReplicationState<Player, any> | null = null;
  private matchReplication:  RxReplicationState<Match,  any> | null = null;

  private onlineHandler  = () => this.startReplication();
  private offlineHandler = () => this.stopReplication();

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    window.addEventListener('online',  this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    if (navigator.onLine) {
      await this.startReplication();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('online',  this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    this.stopReplication();
  }

  // ── Start / Stop ──────────────────────────────────────────────────────────

  async startReplication(): Promise<void> {
    // Only replicate if the user is signed in
    if (!this.auth.isAuthenticated()) {
      console.log('[Replication] Skipped — user not authenticated.');
      return;
    }

    await this.stopReplication();

    const rxdb      = await this.db.getDb();
    const supabase  = this.auth.client;   // shared client — carries the active session

    const playerRepl = new SupabaseReplication<Player>({
      supabaseClient: supabase,
      collection: rxdb.players,
      replicationIdentifier: 'tennis-players-replication',
      pull: { realtimePostgresChanges: true },
      push: {},
      live: true,
      retryTime: 5000
    });

    const matchRepl = new SupabaseReplication<Match>({
      supabaseClient: supabase,
      collection: rxdb.matches,
      replicationIdentifier: 'tennis-matches-replication',
      pull: { realtimePostgresChanges: true },
      push: {},
      live: true,
      retryTime: 5000
    });

    playerRepl.error$.subscribe({
      next:  (err: unknown) => console.warn('[Replication] players error:', err),
      error: (err: unknown) => console.warn('[Replication] players stream error:', err)
    });
    matchRepl.error$.subscribe({
      next:  (err: unknown) => console.warn('[Replication] matches error:', err),
      error: (err: unknown) => console.warn('[Replication] matches stream error:', err)
    });

    Promise.resolve(playerRepl).catch((err: unknown) =>
      console.warn('[Replication] playerRepl init error:', err)
    );
    Promise.resolve(matchRepl).catch((err: unknown) =>
      console.warn('[Replication] matchRepl init error:', err)
    );

    this.playerReplication = playerRepl;
    this.matchReplication  = matchRepl;
    console.log('[Replication] Started ✓');
  }

  async stopReplication(): Promise<void> {
    const cancels: Promise<any>[] = [];
    if (this.playerReplication) { cancels.push(this.playerReplication.cancel()); this.playerReplication = null; }
    if (this.matchReplication)  { cancels.push(this.matchReplication.cancel());  this.matchReplication  = null; }
    if (cancels.length) await Promise.all(cancels);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  get isOnline(): boolean {
    return navigator.onLine;
  }

  get isSyncing(): boolean {
    return (
      !!this.playerReplication && !this.playerReplication.isStopped() &&
      !!this.matchReplication  && !this.matchReplication.isStopped()
    );
  }
}
