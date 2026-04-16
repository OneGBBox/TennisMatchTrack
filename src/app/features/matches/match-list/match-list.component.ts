import {
  Component, OnInit, OnDestroy, signal, computed, inject
} from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription, switchMap, from, combineLatest, map, of } from 'rxjs';

import { DatabaseService } from '../../../core/services/database.service';
import { Match } from '../../../core/models/match.model';
import { Player } from '../../../core/models/player.model';
import { MatchTileComponent } from '../match-tile/match-tile.component';

interface MatchWithPlayers {
  match:   Match;
  player1: Player | null;
  player2: Player | null;
}

@Component({
  selector: 'app-match-list',
  standalone: true,
  imports: [MatchTileComponent],
  template: `
    <div class="page">

      <!-- ── Nav bar ──────────────────────────────────────────── -->
      <header class="nav-bar">
        <h1 class="nav-title">Matches</h1>
        <button class="nav-action" (click)="newMatch()" aria-label="New match">
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
          <!-- Skeleton placeholders -->
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-tile"></div>
          }
        } @else if (rows().length === 0) {
          <!-- Empty state -->
          <div class="empty-state">
            <div class="empty-icon">🎾</div>
            <h2 class="empty-title">No matches yet</h2>
            <p class="empty-body">Tap <strong>+</strong> to start recording your first match.</p>
            <button class="btn-primary empty-cta" (click)="newMatch()">New Match</button>
          </div>
        } @else {
          <!-- Match tiles grouped by status -->
          @if (liveRows().length > 0) {
            <section class="section">
              <h2 class="section-title">In Progress</h2>
              @for (row of liveRows(); track row.match.id) {
                <app-match-tile
                  [match]="row.match"
                  [player1]="row.player1"
                  [player2]="row.player2"
                />
              }
            </section>
          }

          @if (completedRows().length > 0) {
            <section class="section">
              <h2 class="section-title">Completed</h2>
              @for (row of completedRows(); track row.match.id) {
                <app-match-tile
                  [match]="row.match"
                  [player1]="row.player1"
                  [player2]="row.player2"
                />
              }
            </section>
          }
        }
      </div>

      <!-- ── FAB ──────────────────────────────────────────────── -->
      @if (!loading() && rows().length > 0) {
        <button class="fab" (click)="newMatch()" aria-label="New match">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      }
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
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--color-primary);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, transform 0.2s cubic-bezier(0.34,1.5,0.64,1);
    }
    .nav-action:active {
      background: var(--color-primary-dark);
      transform: scale(0.88) rotate(90deg);
    }

    /* ── List content ─────────────────────────────────────────── */
    .list-content {
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    /* ── Sections ─────────────────────────────────────────────── */
    .section { margin-bottom: var(--space-6); }
    .section-title {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: var(--space-3);
      padding-left: 2px;
      animation: tmFadeDown 0.3s ease both;
    }
    .section app-match-tile {
      display: block;
      margin-bottom: var(--space-3);
      animation: tmCardIn 0.42s cubic-bezier(0.34, 1.3, 0.64, 1) both;
    }
    .section app-match-tile:nth-child(1)  { animation-delay: 0.05s; }
    .section app-match-tile:nth-child(2)  { animation-delay: 0.11s; }
    .section app-match-tile:nth-child(3)  { animation-delay: 0.17s; }
    .section app-match-tile:nth-child(4)  { animation-delay: 0.22s; }
    .section app-match-tile:nth-child(n+5){ animation-delay: 0.27s; }

    /* ── Skeleton ─────────────────────────────────────────────── */
    .skeleton-tile {
      height: 120px;
      border-radius: var(--radius-lg);
      background: linear-gradient(90deg,
        var(--color-border-subtle) 25%,
        var(--color-border) 50%,
        var(--color-border-subtle) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      margin-bottom: var(--space-3);
    }
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

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
    .empty-body {
      font-size: var(--font-size-base);
      color: var(--color-text-muted);
      max-width: 240px;
    }
    .empty-cta {
      margin-top: var(--space-4);
      width: 200px;
      border-radius: var(--radius-full);
    }

    /* ── FAB ──────────────────────────────────────────────────── */
    .fab {
      position: fixed;
      right: var(--space-5);
      bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + var(--space-5));
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--color-primary);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0,122,255,0.40);
      transition: transform 0.18s cubic-bezier(0.34,1.5,0.64,1), box-shadow 0.15s ease;
      z-index: 100;
      animation: tmHeartbeat 3s ease-in-out 2s infinite;
    }
    .fab:active {
      transform: scale(0.88) rotate(45deg);
      box-shadow: 0 2px 8px rgba(0,122,255,0.30);
      animation: none;
    }
  `]
})
export class MatchListComponent implements OnInit, OnDestroy {
  private db     = inject(DatabaseService);
  private router = inject(Router);

  loading = signal(true);
  private sub?: Subscription;

  private readonly _rows = signal<MatchWithPlayers[]>([]);

  rows      = computed(() => this._rows());
  liveRows  = computed(() => this._rows().filter(r => r.match.status === 'in_progress'));
  completedRows = computed(() =>
    this._rows().filter(r => r.match.status === 'complete' || r.match.status === 'abandoned')
  );

  async ngOnInit(): Promise<void> {
    const db = await this.db.getDb();

    this.sub = combineLatest([
      db.matches.find({ selector: { _deleted: { $ne: true } } }).sort({ date: 'desc' }).$,
      db.players.find({ selector: { _deleted: { $ne: true } } }).$
    ]).pipe(
      map(([matchDocs, playerDocs]) => {
        const playerMap = new Map<string, Player>(
          playerDocs.map(d => [d.id, d.toJSON() as Player])
        );
        return matchDocs.map(md => {
          const m = md.toJSON() as Match;
          return {
            match:   m,
            player1: playerMap.get(m.player1_id) ?? null,
            player2: playerMap.get(m.player2_id) ?? null
          } as MatchWithPlayers;
        });
      })
    ).subscribe({
      next: rows => {
        this._rows.set(rows);
        this.loading.set(false);
      },
      error: err => console.error('[MatchList] DB stream error:', err)
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  newMatch(): void {
    this.router.navigate(['/matches', 'new']);
  }
}
