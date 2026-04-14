import { Component, input, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { Match } from '../../../core/models/match.model';
import { Player } from '../../../core/models/player.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import {
  deriveMatchSnapshot,
  SetGames
} from '../../../services/tennis-scoring.service';

@Component({
  selector: 'app-match-tile',
  standalone: true,
  imports: [AvatarComponent],
  template: `
    <!-- Tile card -->
    <article class="tile" (click)="open()" role="button" [attr.aria-label]="tileAriaLabel()">

      <!-- ── Blue header ─────────────────────────────────────── -->
      <header class="tile-header">
        <div class="header-left">
          <span class="date">{{ dateLabel() }}</span>
          @if (timeLabel()) {
            <span class="time">{{ timeLabel() }}</span>
          }
        </div>
        <div class="header-right">
          @if (match().location_city) {
            <span class="city">{{ match().location_city }}</span>
          }
          @if (match().weather) {
            <span class="weather">{{ weatherIcon() }} {{ match().weather!.temp_c }}°</span>
          }
          @if (match().status === 'in_progress') {
            <span class="live-badge">LIVE</span>
          }
        </div>
      </header>

      <!-- ── Set score column labels ────────────────────────── -->
      @if (setCount() > 0) {
        <div class="set-labels-row">
          <div class="player-col"></div>
          @for (s of setScores(); track $index) {
            <div class="score-col label">S{{ $index + 1 }}</div>
          }
          <div class="check-col"></div>
        </div>
      }

      <!-- ── Player 1 row ────────────────────────────────────── -->
      <div class="player-row" [class.winner-row]="p1IsWinner()">
        <app-avatar [name]="p1Name()" [imageUrl]="player1()?.image_url" [size]="34" />
        <span class="player-name">{{ p1Name() }}</span>
        @for (s of setScores(); track $index) {
          <div class="score-col" [class.set-won]="s.winner === match().player1_id">
            {{ s.p1 }}
          </div>
        }
        <div class="check-col">
          @if (p1IsWinner()) { <span class="checkmark">✓</span> }
        </div>
      </div>

      <!-- ── Player 2 row ────────────────────────────────────── -->
      <div class="player-row" [class.winner-row]="p2IsWinner()">
        <app-avatar [name]="p2Name()" [imageUrl]="player2()?.image_url" [size]="34" />
        <span class="player-name">{{ p2Name() }}</span>
        @for (s of setScores(); track $index) {
          <div class="score-col" [class.set-won]="s.winner === match().player2_id">
            {{ s.p2 }}
          </div>
        }
        <div class="check-col">
          @if (p2IsWinner()) { <span class="checkmark">✓</span> }
        </div>
      </div>

      <!-- ── Footer: format badge ────────────────────────────── -->
      <footer class="tile-footer">
        <span class="format-badge">{{ formatLabel() }}</span>
        @if (match().scoring_rules.no_ad) {
          <span class="format-badge">No-Ad</span>
        }
        @if (totalPoints() > 0) {
          <span class="pts-badge">{{ totalPoints() }} pts</span>
        }
      </footer>
    </article>
  `,
  styles: [`
    .tile {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .tile:active {
      transform: scale(0.985);
      box-shadow: var(--shadow-sm);
    }

    /* ── Header ──────────────────────────────────────────────── */
    .tile-header {
      background: var(--color-primary);
      padding: var(--space-2) var(--space-4);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-2);
    }
    .header-left, .header-right {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .date {
      color: #fff;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
    }
    .time {
      color: rgba(255,255,255,0.75);
      font-size: var(--font-size-xs);
    }
    .city {
      color: rgba(255,255,255,0.9);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
    }
    .weather {
      color: rgba(255,255,255,0.85);
      font-size: var(--font-size-xs);
    }
    .live-badge {
      background: #FF3B30;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.8px;
      padding: 2px 6px;
      border-radius: var(--radius-full);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* ── Set labels row ──────────────────────────────────────── */
    .set-labels-row {
      display: flex;
      align-items: center;
      padding: 4px var(--space-4) 0;
    }
    .set-labels-row .label {
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
    }

    /* ── Player rows ─────────────────────────────────────────── */
    .player-row {
      display: flex;
      align-items: center;
      padding: var(--space-2) var(--space-4);
      gap: var(--space-3);
    }
    .player-row + .player-row {
      border-top: 1px solid var(--color-border-subtle);
    }
    .winner-row .player-name {
      font-weight: var(--font-weight-bold);
      color: var(--color-primary);
    }
    .player-name {
      flex: 1;
      font-size: var(--font-size-base);
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Score columns ───────────────────────────────────────── */
    .score-col {
      width: 26px;
      text-align: center;
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-secondary);
      flex-shrink: 0;
    }
    .score-col.set-won {
      color: var(--color-text-primary);
      font-weight: var(--font-weight-bold);
    }
    .player-col {
      /* matches avatar width */
      width: 34px;
      flex-shrink: 0;
    }

    /* ── Checkmark column ────────────────────────────────────── */
    .check-col {
      width: 24px;
      text-align: center;
      flex-shrink: 0;
    }
    .checkmark {
      color: var(--color-primary);
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-bold);
    }

    /* ── Footer ──────────────────────────────────────────────── */
    .tile-footer {
      padding: var(--space-2) var(--space-4);
      border-top: 1px solid var(--color-border-subtle);
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
    .format-badge, .pts-badge {
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full);
      padding: 2px var(--space-2);
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      font-weight: var(--font-weight-medium);
    }
  `]
})
export class MatchTileComponent {
  match   = input.required<Match>();
  player1 = input<Player | null | undefined>(undefined);
  player2 = input<Player | null | undefined>(undefined);

  private router = inject(Router);

  // ── Derived values ──────────────────────────────────────────────

  p1Name = computed(() => this.player1()?.name ?? 'Player 1');
  p2Name = computed(() => this.player2()?.name ?? 'Player 2');

  snapshot = computed(() =>
    deriveMatchSnapshot(
      this.match().points_log ?? [],
      this.match().scoring_rules,
      this.match().player1_id,
      this.match().player2_id
    )
  );

  setScores = computed<SetGames[]>(() =>
    // Only show completed sets (exclude the live trailing entry if match ongoing)
    this.snapshot().isMatchComplete
      ? this.snapshot().setScores
      : this.snapshot().setScores.filter(s => s.winner !== null)
  );

  setCount    = computed(() => this.setScores().length);
  totalPoints = computed(() => (this.match().points_log ?? []).length);

  p1IsWinner = computed(() =>
    this.snapshot().matchWinner === this.match().player1_id
  );
  p2IsWinner = computed(() =>
    this.snapshot().matchWinner === this.match().player2_id
  );

  dateLabel = computed(() => {
    const d = new Date(this.match().date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  });

  timeLabel = computed(() => this.match().time ?? null);

  weatherIcon = computed(() => {
    const c = (this.match().weather?.condition ?? '').toLowerCase();
    if (c.includes('sun') || c.includes('clear'))   return '☀️';
    if (c.includes('cloud') || c.includes('overcast')) return '⛅';
    if (c.includes('rain') || c.includes('shower')) return '🌧️';
    if (c.includes('wind'))                          return '💨';
    if (c.includes('snow'))                          return '❄️';
    return '🌤️';
  });

  formatLabel = computed(() => {
    const fmt = this.match().scoring_rules.format;
    const MAP: Record<string, string> = {
      best_of_1: 'Best of 1',
      best_of_3: 'Best of 3',
      best_of_5: 'Best of 5',
      pro_set:   'Pro Set',
      fast4:     'Fast4',
      super_tiebreak: 'Super TB'
    };
    return MAP[fmt] ?? fmt;
  });

  tileAriaLabel = computed(() =>
    `${this.p1Name()} vs ${this.p2Name()}, ${this.dateLabel()}`
  );

  open(): void {
    const m = this.match();
    if (m.status === 'in_progress') {
      this.router.navigate(['/matches', m.id, 'score']);
    } else if (m.status === 'complete') {
      this.router.navigate(['/matches', m.id, 'stats']);
    } else {
      this.router.navigate(['/matches', m.id, 'score']);
    }
  }
}
