import { Injectable } from '@angular/core';
import {
  createRxDatabase,
  RxDatabase,
  RxCollection,
  RxDocument,
  addRxPlugin
} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { v4 as uuidv4 } from 'uuid';

import { playerSchema } from '../../db/schemas/player.schema';
import { matchSchema } from '../../db/schemas/match.schema';
import { playerMigrationStrategies } from '../../db/migrations/player.migration';
import { matchMigrationStrategies } from '../../db/migrations/match.migration';
import { Player } from '../models/player.model';
import { Match } from '../models/match.model';

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
// Window-level singleton
//
// Storing the DB promise on `window` means:
//  • It is shared across all Angular module instances in the same browser tab
//  • Vite HMR module reloads don't lose the reference (window persists)
//  • A real page reload clears window, so the DB is created fresh each time
//
// This prevents DB8 ("database name already in use") that RxDB throws when
// createRxDatabase is called twice in the same JS session (e.g. from a race
// between ReplicationService.init() and MatchListComponent.ngOnInit(), or
// after a Vite HMR-triggered service re-instantiation).
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    __tennisDbPromise?: Promise<TennisDatabase>;
  }
}

function getWindowDbPromise(): Promise<TennisDatabase> | undefined {
  return typeof window !== 'undefined' ? window.__tennisDbPromise : undefined;
}
function setWindowDbPromise(p: Promise<TennisDatabase>): void {
  if (typeof window !== 'undefined') window.__tennisDbPromise = p;
}
function clearWindowDbPromise(): void {
  if (typeof window !== 'undefined') delete window.__tennisDbPromise;
}

@Injectable({ providedIn: 'root' })
export class DatabaseService {

  async getDb(): Promise<TennisDatabase> {
    const existing = getWindowDbPromise();
    if (existing) return existing;

    const promise = this.initDatabase().catch(err => {
      clearWindowDbPromise(); // allow retry on next call
      throw err;
    });

    setWindowDbPromise(promise);
    return promise;
  }

  private async initDatabase(): Promise<TennisDatabase> {
    const db = await createRxDatabase<TennisDatabase>({
      name: 'tennismatchtrack',
      storage: getRxStorageDexie(),
      // closeDuplicates:true closes any stale in-memory RxDB instance left from
      // a previous HMR cycle before creating a fresh one.
      // NOTE: do NOT set ignoreDuplicate:true — in RxDB 17 that flag throws DB9
      // unless the RxDBDevModePlugin is loaded (isDevMode() must return true).
      closeDuplicates: true
    });

    await db.addCollections({
      players: {
        schema: playerSchema,
        migrationStrategies: playerMigrationStrategies
      },
      matches: {
        schema: matchSchema,
        migrationStrategies: matchMigrationStrategies
      }
    });

    return db;
  }

  // ── Players ──────────────────────────────────────────────────────────────

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
    return db.players.upsert({
      ...rest,
      id: id ?? uuidv4(),
      _modified: new Date().toISOString(),
      _deleted: false
    });
  }

  async softDeletePlayer(id: string): Promise<void> {
    const db = await this.getDb();
    const doc = await db.players.findOne(id).exec();
    if (doc) {
      await doc.patch({ _deleted: true, _modified: new Date().toISOString() });
    }
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
      _deleted: false
    });
  }

  async softDeleteMatch(id: string): Promise<void> {
    const db = await this.getDb();
    const doc = await db.matches.findOne(id).exec();
    if (doc) {
      await doc.patch({ _deleted: true, _modified: new Date().toISOString() });
    }
  }
}
