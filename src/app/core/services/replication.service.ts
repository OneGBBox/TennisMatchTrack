import { Injectable, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';

@Injectable({ providedIn: 'root' })
export class ReplicationService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly db   = inject(DatabaseService);

  private subs: Subscription[] = [];
  private onlineHandler  = () => { if (this.auth.isAuthenticated()) this.pullFromSupabase(); };
  private offlineHandler = () => {};

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    window.addEventListener('online',  this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    // Wait for Supabase to restore the session from storage before checking auth
    await this.auth.waitForInit();

    if (!this.auth.isAuthenticated()) {
      return;
    }

    await this.startReplication();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    window.removeEventListener('online',  this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }

  // ── Start / Stop ──────────────────────────────────────────────────────────

  async startReplication(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;

    // Stop any existing subscriptions
    await this.stopReplication();

    const rxdb = await this.db.getDb();

    // 1. Pull existing cloud data into local RxDB
    await this.pullFromSupabase();

    // 2. Watch local changes and push to Supabase in real-time
    this.subs.push(
      rxdb.players.$.subscribe(event => {
        if (event.documentData) {
          this.pushToSupabase('players', event.documentData);
        }
      }),
      rxdb.matches.$.subscribe(event => {
        if (event.documentData) {
          this.pushToSupabase('matches', event.documentData);
        }
      })
    );

  }

  async stopReplication(): Promise<void> {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
  }

  // ── Push: local → Supabase ────────────────────────────────────────────────

  private async pushToSupabase(table: string, doc: any): Promise<void> {
    if (!this.auth.isAuthenticated() || !navigator.onLine) return;
    try {
      // Strip RxDB-internal fields that don't exist as Supabase columns
      const { _rev, _attachments, _meta, ...clean } = doc;
      const { error } = await this.auth.client.from(table).upsert(clean);
      if (error) console.warn(`[Sync] Push ${table} failed:`, error.message);
    } catch (e) {
      console.warn(`[Sync] Push ${table} exception:`, e);
    }
  }

  // ── Pull: Supabase → local ────────────────────────────────────────────────

  async pullFromSupabase(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;

    try {
      const rxdb = await this.db.getDb();
      const uid  = this.auth.uid;

      // ── Players ────────────────────────────────────────────────
      const { data: players, error: pErr } = await this.auth.client
        .from('players')
        .select('*')
        .eq('creator_id', uid);

      if (pErr) console.warn('[Sync] Pull players error:', pErr.message);
      else if (players && players.length > 0) {
        await rxdb.players.bulkUpsert(
          players.map(p => ({
            ...p,
            _modified: p['_modified'] ?? new Date().toISOString(),
            _deleted:  p['_deleted']  ?? false
          }))
        );
      }

      // ── Matches ────────────────────────────────────────────────
      const { data: matches, error: mErr } = await this.auth.client
        .from('matches')
        .select('*')
        .eq('creator_id', uid);

      if (mErr) console.warn('[Sync] Pull matches error:', mErr.message);
      else if (matches && matches.length > 0) {
        await rxdb.matches.bulkUpsert(
          matches.map(m => ({
            ...m,
            _modified:  m['_modified']  ?? new Date().toISOString(),
            _deleted:   m['_deleted']   ?? false,
            points_log: m['points_log'] ?? []
          }))
        );
      }

    } catch (e) {
      console.warn('[Sync] Pull failed:', e);
    }
  }

  // ── Status ────────────────────────────────────────────────────────────────

  get isOnline():  boolean { return navigator.onLine; }
  get isSyncing(): boolean { return navigator.onLine && this.auth.isAuthenticated() && this.subs.length > 0; }
}
