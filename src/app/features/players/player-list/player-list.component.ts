import {
  Component, OnInit, signal, computed, inject
} from '@angular/core';
import { Router } from '@angular/router';
import { map, combineLatest } from 'rxjs';

import { DatabaseService } from '../../../core/services/database.service';
import { Player } from '../../../core/models/player.model';
import { Match } from '../../../core/models/match.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { deriveMatchSnapshot } from '../../../services/tennis-scoring.service';

interface PlayerRow {
  player: Player;
  wins:   number;
  losses: number;
}

@Component({
  selector: 'app-player-list',
  standalone: true,
  imports: [AvatarComponent],
  template: `
    <div class="page">

      <!-- ── Nav bar ──────────────────────────────────────────── -->
      <header class="nav-bar">
        <h1 class="nav-title">Players</h1>
        <button class="nav-action" (click)="newPlayer()" aria-label="Add player">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </header>

      <!-- ── Content ──────────────────────────────────────────── -->
      <div class="page-content list-content">

        @if (loading()) {
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-row"></div>
          }
        } @else if (rows().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">👤</div>
            <h2 class="empty-title">No players yet</h2>
            <p class="empty-body">Add players to start tracking matches.</p>
            <button class="btn-primary empty-cta" (click)="newPlayer()">Add Player</button>
          </div>
        } @else {
          <div class="player-list">
            @for (row of rows(); track row.player.id) {
              <div class="player-card" (click)="editPlayer(row.player.id)">
                <app-avatar [name]="row.player.name" [size]="50" [imageUrl]="row.player.image_url" />

                <div class="player-details">
                  <span class="player-name">{{ row.player.name }}</span>
                  <div class="badge-row">
                    @if (row.player.ntrp_rating) {
                      <span class="badge ntrp">NTRP {{ row.player.ntrp_rating }}</span>
                    }
                    @if (row.player.utr_rating) {
                      <span class="badge utr">UTR {{ row.player.utr_rating }}</span>
                    }
                    @if (row.player.hitting_arm) {
                      <span class="badge arm">{{ row.player.hitting_arm[0] }}H</span>
                    }
                  </div>
                </div>

                <div class="record">
                  <span class="wins">{{ row.wins }}W</span>
                  <span class="record-sep">/</span>
                  <span class="losses">{{ row.losses }}L</span>
                </div>

                <svg class="chevron" width="8" height="14" viewBox="0 0 8 14" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="1 1 7 7 1 13"/>
                </svg>
              </div>
            }
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    /* ── Nav bar ──────────────────────────────────────────────── */
    .nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-4) var(--space-3);
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border-subtle);
    }
    .nav-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }
    .nav-action {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: var(--color-primary);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s;
    }
    .nav-action:active { background: var(--color-primary-dark); }

    /* ── List ─────────────────────────────────────────────────── */
    .list-content { padding: var(--space-4); }
    .player-list { display: flex; flex-direction: column; gap: var(--space-3); }

    /* ── Player card ──────────────────────────────────────────── */
    .player-card {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border-subtle);
      box-shadow: var(--shadow-sm);
      padding: var(--space-3) var(--space-4);
      cursor: pointer;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .player-card:active {
      transform: scale(0.985);
      box-shadow: none;
    }

    /* ── Player info ──────────────────────────────────────────── */
    .player-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .player-name {
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .badge-row {
      display: flex;
      gap: var(--space-1);
      flex-wrap: wrap;
    }
    .badge {
      font-size: 10px;
      font-weight: var(--font-weight-bold);
      padding: 1px 6px;
      border-radius: var(--radius-full);
      letter-spacing: 0.3px;
    }
    .badge.ntrp { background: rgba(0,122,255,0.12); color: var(--color-primary); }
    .badge.utr  { background: rgba(52,199,89,0.12);  color: #34C759; }
    .badge.arm  { background: rgba(142,142,147,0.12); color: var(--color-text-muted); }

    /* ── Record ───────────────────────────────────────────────── */
    .record {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }
    .wins   { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--color-primary); }
    .losses { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--color-loss); }
    .record-sep { font-size: var(--font-size-sm); color: var(--color-text-muted); }

    .chevron { color: var(--color-border); flex-shrink: 0; }

    /* ── Skeleton ─────────────────────────────────────────────── */
    .skeleton-row {
      height: 72px;
      border-radius: var(--radius-lg);
      background: linear-gradient(90deg,
        var(--color-border-subtle) 25%,
        var(--color-border) 50%,
        var(--color-border-subtle) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      margin-bottom: var(--space-3);
    }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* ── Empty state ──────────────────────────────────────────── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--space-12) var(--space-8);
      gap: var(--space-3);
    }
    .empty-icon { font-size: 56px; line-height: 1; }
    .empty-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }
    .empty-body { font-size: var(--font-size-base); color: var(--color-text-muted); }
    .empty-cta { margin-top: var(--space-4); width: 200px; border-radius: var(--radius-full); }
  `]
})
export class PlayerListComponent implements OnInit {
  private db     = inject(DatabaseService);
  private router = inject(Router);

  loading = signal(true);
  private _rows = signal<PlayerRow[]>([]);
  rows = computed(() => this._rows());

  async ngOnInit(): Promise<void> {
    const db = await this.db.getDb();

    combineLatest([
      db.players.find({ selector: { _deleted: { $ne: true } } }).sort({ name: 'asc' }).$,
      db.matches.find({ selector: { _deleted: { $ne: true }, status: { $in: ['complete'] } } }).$
    ]).pipe(
      map(([playerDocs, matchDocs]) => {
        const players = playerDocs.map(d => d.toJSON() as Player);
        const matches = matchDocs.map(d => d.toJSON() as Match);

        return players.map(p => {
          let wins = 0, losses = 0;
          for (const m of matches) {
            if (m.player1_id !== p.id && m.player2_id !== p.id) continue;
            const snap = deriveMatchSnapshot(
              m.points_log ?? [],
              m.scoring_rules,
              m.player1_id,
              m.player2_id
            );
            if (!snap.isMatchComplete) continue;
            if (snap.matchWinner === p.id) wins++;
            else losses++;
          }
          return { player: p, wins, losses } as PlayerRow;
        });
      })
    ).subscribe(rows => {
      this._rows.set(rows);
      this.loading.set(false);
    });
  }

  newPlayer(): void {
    this.router.navigate(['/players', 'new']);
  }

  editPlayer(id: string): void {
    this.router.navigate(['/players', id, 'edit']);
  }
}
