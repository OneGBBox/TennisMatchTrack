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

// RxDB plugins are registered once at module level
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private dbInstance: TennisDatabase | null = null;
  private initPromise: Promise<TennisDatabase> | null = null;

  async getDb(): Promise<TennisDatabase> {
    if (this.dbInstance) return this.dbInstance;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initDatabase();
    this.dbInstance = await this.initPromise;
    return this.dbInstance;
  }

  private async initDatabase(): Promise<TennisDatabase> {
    const db = await createRxDatabase<TennisDatabase>({
      name: 'tennismatchtrack',
      storage: getRxStorageDexie(),
      ignoreDuplicate: true
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
