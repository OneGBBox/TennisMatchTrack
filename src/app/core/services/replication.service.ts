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
    environment.supabaseAnonKey
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

    playerRepl.error$.subscribe((err: unknown) => {
      console.error('[ReplicationService] players error:', err);
    });

    matchRepl.error$.subscribe((err: unknown) => {
      console.error('[ReplicationService] matches error:', err);
    });

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
