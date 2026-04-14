import { Injectable, OnDestroy, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseReplication } from 'rxdb-supabase';
import { RxReplicationState } from 'rxdb/plugins/replication';

import { environment } from '../../../environments/environment';
import { DatabaseService } from './database.service';
import { Player } from '../models/player.model';
import { Match } from '../models/match.model';

@Injectable({ providedIn: 'root' })
export class ReplicationService implements OnDestroy {
  private readonly db = inject(DatabaseService);

  private supabase: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        // Bypass the Navigator Locks API — avoids NavigatorLockAcquireTimeoutError
        // in browsers / contexts where acquiring an exclusive lock times out.
        lock: <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn()
      }
    }
  );

  private playerReplication: RxReplicationState<Player, any> | null = null;
  private matchReplication: RxReplicationState<Match, any> | null = null;

  private onlineHandler = () => this.startReplication();
  private offlineHandler = () => this.stopReplication();

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    if (navigator.onLine) {
      await this.startReplication();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    this.stopReplication();
  }

  // ── Start / Stop ─────────────────────────────────────────────────────────

  async startReplication(): Promise<void> {
    await this.stopReplication();

    const db = await this.db.getDb();

    const playerRepl = new SupabaseReplication<Player>({
      supabaseClient: this.supabase,
      collection: db.players,
      replicationIdentifier: 'tennis-players-replication',
      pull: { realtimePostgresChanges: true },
      push: {},
      live: true,
      retryTime: 5000
    });

    const matchRepl = new SupabaseReplication<Match>({
      supabaseClient: this.supabase,
      collection: db.matches,
      replicationIdentifier: 'tennis-matches-replication',
      pull: { realtimePostgresChanges: true },
      push: {},
      live: true,
      retryTime: 5000
    });

    // Log replication errors without letting them surface as uncaught rejections.
    // rxdb-supabase's initial pull can reject with undefined[0] if Supabase returns
    // null data (e.g. when credentials are invalid / server unreachable).
    playerRepl.error$.subscribe({
      next: (err: unknown) => console.warn('[ReplicationService] players error:', err),
      error: (err: unknown) => console.warn('[ReplicationService] players stream error:', err)
    });
    matchRepl.error$.subscribe({
      next: (err: unknown) => console.warn('[ReplicationService] matches error:', err),
      error: (err: unknown) => console.warn('[ReplicationService] matches stream error:', err)
    });

    // Swallow any synchronous/first-tick promise rejection from the replication setup
    Promise.resolve(playerRepl).catch((err: unknown) =>
      console.warn('[ReplicationService] playerRepl init error:', err)
    );
    Promise.resolve(matchRepl).catch((err: unknown) =>
      console.warn('[ReplicationService] matchRepl init error:', err)
    );

    this.playerReplication = playerRepl;
    this.matchReplication = matchRepl;
  }

  async stopReplication(): Promise<void> {
    const cancels: Promise<any>[] = [];

    if (this.playerReplication) {
      cancels.push(this.playerReplication.cancel());
      this.playerReplication = null;
    }

    if (this.matchReplication) {
      cancels.push(this.matchReplication.cancel());
      this.matchReplication = null;
    }

    if (cancels.length) await Promise.all(cancels);
  }

  // ── Status helpers ────────────────────────────────────────────────────────

  get isOnline(): boolean {
    return navigator.onLine;
  }

  get isSyncing(): boolean {
    return (
      !!this.playerReplication &&
      !this.playerReplication.isStopped() &&
      !!this.matchReplication &&
      !this.matchReplication.isStopped()
    );
  }
}
