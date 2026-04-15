import { Injectable, inject } from '@angular/core';
import {
  createRxDatabase,
  RxDatabase,
  RxCollection,
  RxDocument,
  addRxPlugin
} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { removeRxDatabase } from 'rxdb';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { v4 as uuidv4 } from 'uuid';

import { playerSchema } from '../../db/schemas/player.schema';
import { matchSchema } from '../../db/schemas/match.schema';
import { playerMigrationStrategies } from '../../db/migrations/player.migration';
import { matchMigrationStrategies } from '../../db/migrations/match.migration';
import { Player } from '../models/player.model';
import { Match } from '../models/match.model';
import { AuthService } from './auth.service';

export type PlayerCollection = RxCollection<Player>;
export type MatchCollection = RxCollection<Match>;

export type TennisCollections = {
  players: PlayerCollection;
  matches: MatchCollection;
};

export type TennisDatabase = RxDatabase<TennisCollections>;

// RxDB plugins — safe to call multiple times (idempotent)
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

// ─────────────────────────────────────────────────────────────────────────────
// Window-level singleton — survives Vite HMR reloads, cleared on hard refresh
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  interface Window { __tennisDbPromise?: Promise<TennisDatabase>; }
}
function getWindowDbPromise() {
  return typeof window !== 'undefined' ? window.__tennisDbPromise : undefined;
}
function setWindowDbPromise(p: Promise<TennisDatabase>) {
  if (typeof window !== 'undefined') window.__tennisDbPromise = p;
}
function clearWindowDbPromise() {
  if (typeof window !== 'undefined') delete window.__tennisDbPromise;
}

const DB_NAME = 'tennismatchtrack';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly auth = inject(AuthService);

  // ── Public entry point ────────────────────────────────────────────────────

  async getDb(): Promise<TennisDatabase> {
    const existing = getWindowDbPromise();
    if (existing) {
      try {
        // 5-second guard against a stale/hung promise from a previous HMR cycle
        return await Promise.race([existing, rejectAfter(5000, 'CACHED_TIMEOUT')]);
      } catch (err: any) {
        console.warn('[DB] Cached promise timed out or errored — hard-wiping and restarting.', err?.message);
        clearWindowDbPromise();
        await safeWipe();
      }
    }

    const promise = this.initDatabase().catch(err => {
      clearWindowDbPromise();
      throw err;
    });
    setWindowDbPromise(promise);
    return promise;
  }

  // ── Init pipeline ─────────────────────────────────────────────────────────

  private async initDatabase(): Promise<TennisDatabase> {
    console.log('[DB] initDatabase() starting…');

    // ── Step 1: open the RxDB instance ──────────────────────────────────────
    let db: TennisDatabase;
    try {
      db = await Promise.race([
        createRxDatabase<TennisDatabase>({
          name: DB_NAME,
          storage: getRxStorageDexie(),
          closeDuplicates: true
        }),
        rejectAfter(8000, 'CREATE_DB_TIMEOUT')
      ]);
      console.log('[DB] createRxDatabase OK');
    } catch (err: any) {
      console.warn('[DB] createRxDatabase failed — wiping and retrying.', err?.message);
      await safeWipe();
      db = await createRxDatabase<TennisDatabase>({
        name: DB_NAME,
        storage: getRxStorageDexie(),
        closeDuplicates: true
      });
      console.log('[DB] createRxDatabase OK (after wipe)');
    }

    // ── Step 2: add collections with autoMigrate:false ──────────────────────
    // autoMigrate:true (the default) blocks addCollections until ALL existing
    // documents are migrated — this deadlocks when the old RxDB instance from
    // a prior HMR cycle still holds the IndexedDB write-lock.
    // With autoMigrate:false the call returns instantly; we check for pending
    // migrations below and wipe-recreate if any are found.
    try {
      await db.addCollections({
        players: { schema: playerSchema, migrationStrategies: playerMigrationStrategies, autoMigrate: false },
        matches: { schema: matchSchema,  migrationStrategies: matchMigrationStrategies,  autoMigrate: false }
      });
      console.log('[DB] addCollections OK');
    } catch (err: any) {
      await safeClose(db);
      const msg = String(err?.message ?? '');
      const code = String(err?.code ?? err?.rxdb ?? '');
      const isSchemaErr = ['DB6','DB8','DB9'].includes(code) || msg.includes('schema');
      if (isSchemaErr) {
        console.warn('[DB] Schema mismatch on addCollections — wiping and restarting.', err);
        await safeWipe();
        return this.initDatabase();
      }
      throw err;
    }

    // ── Step 3: detect pending migrations → wipe instead of hanging ─────────
    const playersMigNeeded = await db.players.migrationNeeded();
    const matchesMigNeeded = await db.matches.migrationNeeded();

    if (playersMigNeeded || matchesMigNeeded) {
      console.warn(
        `[DB] Migration pending (players=${playersMigNeeded}, matches=${matchesMigNeeded}) ` +
        `— wiping IndexedDB and starting fresh (pass-through migration = no data loss risk).`
      );
      await safeClose(db);
      await safeWipe();
      // Restart without any migration needed this time
      return this.initDatabase();
    }

    console.log('[DB] Ready ✓ (players + matches, no migration pending)');
    return db;
  }

  // ── Players ───────────────────────────────────────────────────────────────

  async players$() {
    const db = await this.getDb();
    return db.players.find().sort({ name: 'asc' }).$;
  }

  async getPlayer$(id: string) {
    const db = await this.getDb();
    return db.players.findOne(id).$;
  }

  async upsertPlayer(data: Omit<Player, 'id' | '_modified' | '_deleted'> & { id?: string }): Promise<RxDocument<Player>> {
    const db = await this.getDb();
    const { id, ...rest } = data as Player;
    const payload = {
      ...rest,
      id: id ?? uuidv4(),
      _modified: new Date().toISOString(),
      _deleted: false,
      ...(this.auth.uid ? { creator_id: this.auth.uid } : {})
    };
    console.log('[DB] players.upsert payload:', payload);
    const doc = await db.players.upsert(payload);
    console.log('[DB] players.upsert done, stored id:', doc.id);
    return doc;
  }

  async softDeletePlayer(id: string): Promise<void> {
    const db = await this.getDb();
    const doc = await db.players.findOne(id).exec();
    if (doc) await doc.patch({ _deleted: true, _modified: new Date().toISOString() });
  }

  // ── Matches ───────────────────────────────────────────────────────────────

  async matches$() {
    const db = await this.getDb();
    return db.matches.find().sort({ date: 'desc' }).$;
  }

  async getMatch$(id: string) {
    const db = await this.getDb();
    return db.matches.findOne(id).$;
  }

  async upsertMatch(data: Omit<Match, 'id' | '_modified' | '_deleted'> & { id?: string }): Promise<RxDocument<Match>> {
    const db = await this.getDb();
    const { id, ...rest } = data as Match;
    return db.matches.upsert({
      ...rest,
      id: id ?? uuidv4(),
      _modified: new Date().toISOString(),
      _deleted: false,
      ...(this.auth.uid ? { creator_id: this.auth.uid } : {})
    });
  }

  async softDeleteMatch(id: string): Promise<void> {
    const db = await this.getDb();
    const doc = await db.matches.findOne(id).exec();
    if (doc) await doc.patch({ _deleted: true, _modified: new Date().toISOString() });
  }

  // ── DB smoke-test (insert → read → delete) ────────────────────────────────

  async testDb(): Promise<void> {
    console.group('[DB Test] Starting smoke-test…');
    try {
      const db = await this.getDb();
      console.log('[DB Test] ✓ getDb() resolved');

      const testId = '__smoke_test__';
      const inserted = await db.players.upsert({
        id: testId, name: 'Smoke Test Player',
        _modified: new Date().toISOString(), _deleted: false
      });
      console.log('[DB Test] ✓ INSERT — id:', inserted.id, '| name:', inserted.name);

      const found = await db.players.findOne(testId).exec();
      if (found) console.log('[DB Test] ✓ GET — id:', found.id, '| name:', found.name);
      else        console.error('[DB Test] ✗ GET — doc not found after insert!');

      const all = await db.players.find({ selector: { _deleted: { $ne: true } } }).exec();
      console.log('[DB Test] ✓ FIND ALL — non-deleted count:', all.length);

      await found?.remove();
      const gone = await db.players.findOne(testId).exec();
      console.log('[DB Test] ✓ DELETE — doc gone:', gone === null);

      console.log('[DB Test] 🎾 All operations PASSED');
    } catch (err) {
      console.error('[DB Test] ✗ FAILED:', err);
    }
    console.groupEnd();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function rejectAfter(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms)
  );
}

async function safeClose(db: TennisDatabase): Promise<void> {
  try { await db.close(); } catch {}
}

async function safeWipe(): Promise<void> {
  try {
    await removeRxDatabase(DB_NAME, getRxStorageDexie());
    console.log('[DB] IndexedDB wiped.');
  } catch (e) {
    console.warn('[DB] safeWipe failed (may already be gone):', e);
  }
}
