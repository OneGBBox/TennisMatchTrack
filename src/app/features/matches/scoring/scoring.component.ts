import {
  Component, OnInit, OnDestroy, signal, computed, effect, inject
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { DatabaseService } from '../../../core/services/database.service';
import { TennisScoringService, RecordPointInput } from '../../../services/tennis-scoring.service';
import { Match } from '../../../core/models/match.model';
import { Player } from '../../../core/models/player.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { PointModalComponent } from './point-modal.component';

@Component({
  selector: 'app-scoring',
  standalone: true,
  imports: [AvatarComponent, PointModalComponent],
  template: `
    <div class="page scoring-page">

      <!-- ── Top bar ────────────────────────────────────────────── -->
      <header class="score-header">
        <button class="header-btn" (click)="back()" aria-label="Back">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 1 1 9 9 17"/>
          </svg>
        </button>

        <div class="header-center">
          @if (scoring.matchStatus() === 'in_progress') {
            <span class="live-chip">LIVE</span>
          }
          @if (locationCity()) {
            <span class="header-location">{{ locationCity() }}</span>
          }
        </div>

        <div class="header-actions">
          <button
            class="header-btn"
            [disabled]="!scoring.canUndo()"
            (click)="undo()"
            aria-label="Undo"
          >↩</button>
          <button
            class="header-btn"
            [disabled]="!scoring.canRedo()"
            (click)="redo()"
            aria-label="Redo"
          >↪</button>
        </div>
      </header>

      @if (matchLoaded()) {
        <!-- ── Set scores bar ────────────────────────────────────── -->
        <div class="sets-bar">
          @for (set of scoring.setScores(); track $index) {
            <div class="set-chip" [class.current]="isCurrentSet($index)">
              <span [class.winner]="set.winner === p1Id()">{{ set.p1 }}</span>
              <span class="set-sep">–</span>
              <span [class.winner]="set.winner === p2Id()">{{ set.p2 }}</span>
            </div>
          }
        </div>

        <!-- ── Main score area ────────────────────────────────────── -->
        <div class="score-arena">

          <!-- Player 1 side -->
          <div
            class="player-side p1-side"
            [class.serving]="scoring.currentServer() === p1Id()"
            (click)="!scoring.isMatchComplete() && openModal(p1Id())"
            role="button"
            [attr.aria-label]="'Award point to ' + p1Name()"
          >
            <!-- Server ball -->
            <div class="server-ball" [class.visible]="scoring.currentServer() === p1Id()">🎾</div>

            <!-- Avatar + name -->
            <div class="player-info">
              <app-avatar [name]="p1Name()" [size]="52" />
              <span class="player-name-label">{{ p1Name() }}</span>
            </div>

            <!-- Game score -->
            <div class="game-score" [class.ad]="scoring.displayScore().p1 === 'Ad'">
              {{ scoring.displayScore().p1 }}
            </div>

            <!-- Sets won -->
            <div class="sets-won-row">
              @for (i of setsWonArr(scoring.setsWon().p1); track i) {
                <span class="set-dot"></span>
              }
            </div>
          </div>

          <!-- Divider -->
          <div class="score-divider">
            <div class="game-label">
              @if (scoring.displayScore().label) {
                {{ scoring.displayScore().label }}
              } @else {
                {{ setProgressLabel() }}
              }
            </div>
            @if (scoring.isTiebreak() || scoring.isSuperTiebreak()) {
              <div class="tb-label">
                {{ scoring.isSuperTiebreak() ? 'Super Tiebreak' : 'Tiebreak' }}
              </div>
            }
          </div>

          <!-- Player 2 side -->
          <div
            class="player-side p2-side"
            [class.serving]="scoring.currentServer() === p2Id()"
            (click)="!scoring.isMatchComplete() && openModal(p2Id())"
            role="button"
            [attr.aria-label]="'Award point to ' + p2Name()"
          >
            <div class="server-ball" [class.visible]="scoring.currentServer() === p2Id()">🎾</div>

            <div class="player-info">
              <app-avatar [name]="p2Name()" [size]="52" />
              <span class="player-name-label">{{ p2Name() }}</span>
            </div>

            <div class="game-score" [class.ad]="scoring.displayScore().p2 === 'Ad'">
              {{ scoring.displayScore().p2 }}
            </div>

            <div class="sets-won-row">
              @for (i of setsWonArr(scoring.setsWon().p2); track i) {
                <span class="set-dot"></span>
              }
            </div>
          </div>
        </div>

        <!-- ── Serve toggle ──────────────────────────────────────── -->
        @if (!scoring.isMatchComplete()) {
          <div class="serve-row">
            <span class="serve-row-label">Serve</span>
            <div class="serve-toggle">
              <button [class.on]="serveNumber() === 1" (click)="serveNumber.set(1)">1st</button>
              <button [class.on]="serveNumber() === 2" (click)="serveNumber.set(2)">2nd</button>
            </div>
          </div>
        }

        <!-- ── Match complete banner ────────────────────────────── -->
        @if (scoring.isMatchComplete()) {
          <div class="complete-banner">
            <span class="banner-icon">🏆</span>
            <span class="banner-text">{{ winnerName() }} wins!</span>
            <button class="banner-stats" (click)="viewStats()">View Stats</button>
          </div>
        }

        <!-- ── Tap hint ──────────────────────────────────────────── -->
        @if (!scoring.isMatchComplete() && scoring.pointsLog().length === 0) {
          <p class="tap-hint">Tap a player's side to award a point</p>
        }

        <!-- ── Bottom action bar ─────────────────────────────────── -->
        <div class="bottom-bar">
          @if (!scoring.isMatchComplete()) {
            <button class="end-btn" (click)="endMatch()">End Match</button>
          } @else {
            <button class="end-btn primary" (click)="viewStats()">View Stats</button>
          }
        </div>

      } @else {
        <!-- Loading -->
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading match…</p>
        </div>
      }

      <!-- ── Point modal (portal) ──────────────────────────────── -->
      @if (showModal()) {
        <app-point-modal
          [winnerId]="modalWinnerId()"
          [serverId]="scoring.currentServer()"
          [winnerName]="modalWinnerName()"
          (recorded)="onPointRecorded($event)"
          (cancelled)="closeModal()"
        />
      }

    </div>
  `,
  styles: [`
    /* ── Page ─────────────────────────────────────────────────── */
    .scoring-page {
      background: #0a0f1e;  /* dark court blue */
      color: #fff;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ───────────────────────────────────────────────── */
    .score-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
    }
    .header-center {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .header-actions {
      display: flex;
      gap: var(--space-2);
    }
    .header-btn {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.12);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: var(--font-size-base);
      transition: background 0.15s;
    }
    .header-btn:disabled { opacity: 0.3; cursor: default; }
    .header-btn:not(:disabled):active { background: rgba(255,255,255,0.22); }
    .live-chip {
      background: #FF3B30;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.8px;
      padding: 2px 7px;
      border-radius: var(--radius-full);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
    .header-location {
      font-size: var(--font-size-sm);
      color: rgba(255,255,255,0.6);
    }

    /* ── Sets bar ─────────────────────────────────────────────── */
    .sets-bar {
      display: flex;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-4);
    }
    .set-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(255,255,255,0.08);
      border-radius: var(--radius-full);
      padding: 4px 12px;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: rgba(255,255,255,0.65);
    }
    .set-chip.current {
      background: rgba(0,122,255,0.25);
      color: #fff;
    }
    .set-chip .winner {
      color: #fff;
      font-weight: var(--font-weight-bold);
    }
    .set-sep { opacity: 0.4; }

    /* ── Score arena ──────────────────────────────────────────── */
    .score-arena {
      flex: 1;
      display: flex;
      align-items: stretch;
      padding: var(--space-4);
      gap: var(--space-2);
      min-height: 0;
    }

    /* ── Player sides ─────────────────────────────────────────── */
    .player-side {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
      border-radius: var(--radius-lg);
      background: rgba(255,255,255,0.06);
      padding: var(--space-6) var(--space-3);
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      -webkit-tap-highlight-color: transparent;
      position: relative;
      overflow: hidden;
      min-height: 280px;
    }
    .player-side:active {
      background: rgba(255,255,255,0.12);
      transform: scale(0.98);
    }
    .player-side.serving {
      background: rgba(0,122,255,0.15);
      box-shadow: inset 0 0 0 2px rgba(0,122,255,0.4);
    }

    /* Server ball indicator */
    .server-ball {
      position: absolute;
      top: var(--space-3);
      font-size: 18px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .server-ball.visible { opacity: 1; }

    /* Avatar + name */
    .player-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
    }
    .player-name-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: rgba(255,255,255,0.8);
      text-align: center;
    }

    /* Big score number */
    .game-score {
      font-size: 72px;
      font-weight: 800;
      line-height: 1;
      color: #fff;
      letter-spacing: -2px;
    }
    .game-score.ad {
      font-size: 48px;
      color: var(--color-accent);
    }

    /* Sets won dots */
    .sets-won-row {
      display: flex;
      gap: 6px;
      min-height: 10px;
    }
    .set-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--color-accent);
    }

    /* ── Centre divider ───────────────────────────────────────── */
    .score-divider {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 60px;
      flex-shrink: 0;
    }
    .game-label {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      text-align: center;
      line-height: 1.3;
    }
    .tb-label {
      font-size: 9px;
      background: var(--color-accent);
      color: #000;
      border-radius: var(--radius-full);
      padding: 2px 6px;
      font-weight: var(--font-weight-bold);
      text-align: center;
    }

    /* ── Serve toggle ─────────────────────────────────────────── */
    .serve-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
    }
    .serve-row-label {
      font-size: var(--font-size-sm);
      color: rgba(255,255,255,0.5);
    }
    .serve-toggle {
      display: flex;
      background: rgba(255,255,255,0.08);
      border-radius: var(--radius-full);
      padding: 2px;
      gap: 2px;
    }
    .serve-toggle button {
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-full);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: rgba(255,255,255,0.55);
      transition: background 0.15s, color 0.15s;
    }
    .serve-toggle button.on {
      background: var(--color-primary);
      color: #fff;
    }

    /* ── Complete banner ──────────────────────────────────────── */
    .complete-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      background: linear-gradient(135deg, #f0b429, #c88f00);
      padding: var(--space-4);
      margin: 0 var(--space-4);
      border-radius: var(--radius-lg);
    }
    .banner-icon { font-size: 28px; }
    .banner-text {
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-bold);
      color: #000;
    }
    .banner-stats {
      background: rgba(0,0,0,0.25);
      color: #000;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-full);
    }

    /* ── Tap hint ─────────────────────────────────────────────── */
    .tap-hint {
      text-align: center;
      color: rgba(255,255,255,0.35);
      font-size: var(--font-size-sm);
      padding: var(--space-3) var(--space-4);
    }

    /* ── Bottom bar ───────────────────────────────────────────── */
    .bottom-bar {
      padding: var(--space-3) var(--space-4);
      padding-bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + var(--space-3));
    }
    .end-btn {
      width: 100%;
      height: 48px;
      border-radius: var(--radius-full);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.65);
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
      transition: background 0.15s;
    }
    .end-btn.primary {
      background: var(--color-primary);
      color: #fff;
    }
    .end-btn:active { background: rgba(255,255,255,0.15); }

    /* ── Loading ──────────────────────────────────────────────── */
    .loading-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
      color: rgba(255,255,255,0.6);
    }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(255,255,255,0.15);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ScoringComponent implements OnInit, OnDestroy {
  private db      = inject(DatabaseService);
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  readonly scoring = inject(TennisScoringService);

  // ── Local state ───────────────────────────────────────────────────────────
  matchLoaded   = signal(false);
  matchId       = signal('');
  p1Id          = signal('');
  p2Id          = signal('');
  p1Name        = signal('Player 1');
  p2Name        = signal('Player 2');
  locationCity  = signal<string | null>(null);
  serveNumber   = signal<1 | 2>(1);

  showModal       = signal(false);
  modalWinnerId   = signal('');
  modalWinnerName = signal('');

  // ── Computed ──────────────────────────────────────────────────────────────
  winnerName = computed(() => {
    const w = this.scoring.winner();
    if (!w) return '';
    return w === this.p1Id() ? this.p1Name() : this.p2Name();
  });

  setProgressLabel = computed(() => {
    const snap = this.scoring.snapshot();
    const setIdx = snap.currentSetIdx + 1;
    return `Set ${setIdx}`;
  });

  setsWonArr(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  isCurrentSet(idx: number): boolean {
    const snap = this.scoring.snapshot();
    return !snap.isMatchComplete && idx === snap.setScores.length - 1;
  }

  // ── Persistence effect ────────────────────────────────────────────────────
  private persistEffect = effect(() => {
    const log    = this.scoring.pointsLog();
    const status = this.scoring.matchStatus();
    const id     = this.matchId();
    if (!id || !this.matchLoaded()) return;

    // Fire-and-forget persistence
    this.db.getDb().then(db => {
      db.matches.findOne(id).exec().then(doc => {
        if (doc) {
          doc.patch({
            points_log: log,
            status,
            _modified: new Date().toISOString()
          });
        }
      });
    });
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    const id             = this.route.snapshot.paramMap.get('id') ?? '';
    const initialServer  = this.route.snapshot.queryParamMap.get('server') ?? '';
    this.matchId.set(id);

    const db = await this.db.getDb();
    db.matches.findOne(id).$
      .pipe(map(doc => (doc ? (doc.toJSON() as Match) : null)))
      .subscribe(async match => {
        if (!match) return;

        // Load players
        const [p1doc, p2doc] = await Promise.all([
          db.players.findOne(match.player1_id).exec(),
          db.players.findOne(match.player2_id).exec()
        ]);
        const p1 = p1doc ? (p1doc.toJSON() as Player) : null;
        const p2 = p2doc ? (p2doc.toJSON() as Player) : null;

        this.p1Id.set(match.player1_id);
        this.p2Id.set(match.player2_id);
        this.p1Name.set(p1?.name ?? 'Player 1');
        this.p2Name.set(p2?.name ?? 'Player 2');
        this.locationCity.set(match.location_city ?? null);

        // Only initialise scoring service once
        if (!this.matchLoaded()) {
          const server = initialServer || match.player1_id;
          this.scoring.startMatch(
            id,
            match.player1_id,
            match.player2_id,
            match.scoring_rules,
            server,
            match.points_log ?? []
          );
          this.matchLoaded.set(true);
        }
      });
  }

  ngOnDestroy(): void {
    this.scoring.resetMatch();
  }

  // ── Modal ──────────────────────────────────────────────────────────────────
  openModal(winnerId: string): void {
    if (this.scoring.isMatchComplete()) return;
    this.modalWinnerId.set(winnerId);
    this.modalWinnerName.set(winnerId === this.p1Id() ? this.p1Name() : this.p2Name());
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  onPointRecorded(input: RecordPointInput): void {
    this.scoring.recordPoint({ ...input, serve_number: this.serveNumber() });
    this.closeModal();
    // Reset serve number to 1 after point
    this.serveNumber.set(1);
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  undo(): void { this.scoring.undo(); }
  redo(): void { this.scoring.redo(); }

  viewStats(): void {
    this.router.navigate(['/matches', this.matchId(), 'stats']);
  }

  async endMatch(): Promise<void> {
    const id = this.matchId();
    const db = await this.db.getDb();
    const doc = await db.matches.findOne(id).exec();
    if (doc) {
      await doc.patch({
        status: 'abandoned',
        _modified: new Date().toISOString()
      });
    }
    this.router.navigate(['/matches']);
  }

  back(): void {
    this.router.navigate(['/matches']);
  }
}
