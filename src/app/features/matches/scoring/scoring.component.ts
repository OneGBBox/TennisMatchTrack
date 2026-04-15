import {
  Component, OnInit, OnDestroy, signal, computed, effect, inject
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, map } from 'rxjs';

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

      <!-- ── Top bar ───────────────────────────────────────────── -->
      <header class="score-header">
        <button class="header-btn" (click)="back()" aria-label="Back">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 1 1 9 9 17"/>
          </svg>
        </button>

        <div class="header-center">
          @if (!scoring.isMatchComplete() && scoring.matchStatus() === 'in_progress') {
            <span class="live-chip">LIVE</span>
          }
          @if (isSimpleMode()) {
            <span class="mode-chip">SIMPLE</span>
          }
          @if (locationCity()) {
            <span class="header-location">{{ locationCity() }}</span>
          }
        </div>

        <div class="header-actions">
          @if (!scoring.isMatchComplete()) {
            <button class="header-btn" [disabled]="!scoring.canUndo()" (click)="undo()" aria-label="Undo">↩</button>
            <button class="header-btn" [disabled]="!scoring.canRedo()" (click)="redo()" aria-label="Redo">↪</button>
          }
        </div>
      </header>

      @if (matchLoaded()) {

        <!-- ── Set scores bar ─────────────────────────────────── -->
        <div class="sets-bar">
          @for (set of scoring.setScores(); track $index) {
            <div class="set-chip" [class.current]="isCurrentSet($index)">
              <span [class.winner]="set.winner === p1Id()">{{ set.p1 }}</span>
              <span class="set-sep">–</span>
              <span [class.winner]="set.winner === p2Id()">{{ set.p2 }}</span>
            </div>
          }
        </div>

        <!-- ════════════════════════════════════════════════════
             MATCH IN PROGRESS — interactive scoring arena
             ════════════════════════════════════════════════════ -->
        @if (!isLocked()) {

          <div class="score-arena">

            <!-- Player 1 side -->
            <div
              class="player-side p1-side"
              [class.serving]="scoring.currentServer() === p1Id()"
              (click)="onSideTap(p1Id())"
              role="button"
              [attr.aria-label]="'Award point to ' + p1Name()"
            >
              <div class="server-ball" [class.visible]="scoring.currentServer() === p1Id()">🎾</div>

              <div class="player-info">
                <app-avatar [name]="p1Name()" [size]="52" />
                <span class="player-name-label">{{ p1Name() }}</span>
              </div>

              <div class="game-score" [class.ad]="scoring.displayScore().p1 === 'Ad'">
                {{ scoring.displayScore().p1 }}
              </div>

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
                  {{ scoring.isSuperTiebreak() ? 'Super TB' : 'Tiebreak' }}
                </div>
              }
            </div>

            <!-- Player 2 side -->
            <div
              class="player-side p2-side"
              [class.serving]="scoring.currentServer() === p2Id()"
              (click)="onSideTap(p2Id())"
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

          <!-- Serve toggle -->
          <div class="serve-row">
            <span class="serve-row-label">Serve</span>
            <div class="serve-toggle">
              <button [class.on]="serveNumber() === 1" (click)="serveNumber.set(1)">1st</button>
              <button [class.on]="serveNumber() === 2" (click)="serveNumber.set(2)">2nd</button>
            </div>
          </div>

          <!-- Tap hint -->
          @if (scoring.pointsLog().length === 0) {
            <p class="tap-hint">
              @if (isSimpleMode()) {
                Tap a player to award a point
              } @else {
                Tap a player's side to log a point with details
              }
            </p>
          }

          <!-- Bottom bar -->
          <div class="bottom-bar">
            <button class="end-btn" (click)="endMatch()">End Match</button>
          </div>

        }

        <!-- ════════════════════════════════════════════════════
             MATCH COMPLETE — locked result view, no score numbers
             ════════════════════════════════════════════════════ -->
        @if (isLocked()) {
          <div class="result-screen">

            <!-- Trophy / ended icon -->
            <div class="result-trophy">
              {{ scoring.isMatchComplete() ? '🏆' : '🎾' }}
            </div>
            <h2 class="result-winner">
              {{ scoring.isMatchComplete() ? winnerName() + ' wins!' : 'Match Ended' }}
            </h2>

            <!-- Final set scores -->
            <div class="result-sets">
              @for (set of scoring.setScores(); track $index) {
                <div class="result-set-chip">
                  <span [class.result-winner-score]="set.winner === p1Id()">{{ set.p1 }}</span>
                  <span class="result-set-sep">–</span>
                  <span [class.result-winner-score]="set.winner === p2Id()">{{ set.p2 }}</span>
                </div>
              }
            </div>

            <!-- Player cards (static, no interaction) -->
            <div class="result-players">
              <div class="result-player"
                   [class.result-player-won]="scoring.isMatchComplete() && scoring.winner() === p1Id()">
                <app-avatar [name]="p1Name()" [size]="56" />
                <span class="result-player-name">{{ p1Name() }}</span>
                @if (scoring.isMatchComplete() && scoring.winner() === p1Id()) {
                  <span class="result-crown">👑</span>
                }
              </div>
              <span class="result-vs">vs</span>
              <div class="result-player"
                   [class.result-player-won]="scoring.isMatchComplete() && scoring.winner() === p2Id()">
                <app-avatar [name]="p2Name()" [size]="56" />
                <span class="result-player-name">{{ p2Name() }}</span>
                @if (scoring.isMatchComplete() && scoring.winner() === p2Id()) {
                  <span class="result-crown">👑</span>
                }
              </div>
            </div>

            <!-- Stats button -->
            <button class="stats-btn" (click)="viewStats()">
              View Match Stats
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>

            <button class="back-matches-btn" (click)="back()">Back to Matches</button>
          </div>
        }

      } @else {
        <!-- Loading -->
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading match…</p>
        </div>
      }

      <!-- ── Point modal (detail mode only) ───────────────────── -->
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
      background: #0a0f1e;
      color: #fff;
      display: flex;
      flex-direction: column;
      min-height: 100%;
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
    .header-actions { display: flex; gap: var(--space-2); }
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
      font-size: 9px; font-weight: 800; letter-spacing: 0.8px;
      padding: 2px 7px;
      border-radius: var(--radius-full);
      animation: pulse 1.5s infinite;
    }
    .mode-chip {
      background: rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.7);
      font-size: 9px; font-weight: 700; letter-spacing: 0.6px;
      padding: 2px 7px;
      border-radius: var(--radius-full);
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
    .header-location { font-size: var(--font-size-sm); color: rgba(255,255,255,0.6); }

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
    .set-chip.current { background: rgba(0,122,255,0.25); color: #fff; }
    .set-chip .winner { color: #fff; font-weight: var(--font-weight-bold); }
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
      background: rgba(255,255,255,0.14);
      transform: scale(0.97);
    }
    .player-side.serving {
      background: rgba(0,122,255,0.15);
      box-shadow: inset 0 0 0 2px rgba(0,122,255,0.4);
    }

    .server-ball {
      position: absolute; top: var(--space-3);
      font-size: 18px; opacity: 0; transition: opacity 0.2s;
    }
    .server-ball.visible { opacity: 1; }

    .player-info {
      display: flex; flex-direction: column;
      align-items: center; gap: var(--space-2);
    }
    .player-name-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: rgba(255,255,255,0.8);
      text-align: center;
    }

    .game-score {
      font-size: 72px;
      font-weight: 800;
      line-height: 1;
      color: #fff;
      letter-spacing: -2px;
    }
    .game-score.ad { font-size: 48px; color: var(--color-accent); }

    .sets-won-row { display: flex; gap: 6px; min-height: 10px; }
    .set-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--color-accent);
    }

    /* ── Centre divider ───────────────────────────────────────── */
    .score-divider {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 6px; width: 60px; flex-shrink: 0;
    }
    .game-label {
      font-size: 11px; color: rgba(255,255,255,0.5);
      text-align: center; line-height: 1.3;
    }
    .tb-label {
      font-size: 9px; background: var(--color-accent);
      color: #000; border-radius: var(--radius-full);
      padding: 2px 6px; font-weight: var(--font-weight-bold); text-align: center;
    }

    /* ── Serve toggle ─────────────────────────────────────────── */
    .serve-row {
      display: flex; align-items: center;
      justify-content: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
    }
    .serve-row-label { font-size: var(--font-size-sm); color: rgba(255,255,255,0.5); }
    .serve-toggle {
      display: flex;
      background: rgba(255,255,255,0.08);
      border-radius: var(--radius-full);
      padding: 2px; gap: 2px;
    }
    .serve-toggle button {
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-full);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: rgba(255,255,255,0.55);
      transition: background 0.15s, color 0.15s;
    }
    .serve-toggle button.on { background: var(--color-primary); color: #fff; }

    /* ── Tap hint ─────────────────────────────────────────────── */
    .tap-hint {
      text-align: center;
      color: rgba(255,255,255,0.35);
      font-size: var(--font-size-sm);
      padding: var(--space-2) var(--space-4);
    }

    /* ── Bottom bar ───────────────────────────────────────────── */
    .bottom-bar {
      padding: var(--space-3) var(--space-4);
      padding-bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + var(--space-3));
    }
    .end-btn {
      width: 100%; height: 48px;
      border-radius: var(--radius-full);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.65);
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
      transition: background 0.15s;
    }
    .end-btn:active { background: rgba(255,255,255,0.15); }

    /* ── Match complete result screen ─────────────────────────── */
    .result-screen {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-5);
      padding: var(--space-8) var(--space-6);
      padding-bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + var(--space-8));
      text-align: center;
    }

    .result-trophy { font-size: 64px; line-height: 1; }

    .result-winner {
      font-size: var(--font-size-2xl);
      font-weight: 800;
      color: var(--color-accent);
      letter-spacing: -0.5px;
    }

    /* Final set score chips */
    .result-sets {
      display: flex;
      gap: var(--space-3);
      justify-content: center;
    }
    .result-set-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.1);
      border-radius: var(--radius-lg);
      padding: var(--space-3) var(--space-5);
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: rgba(255,255,255,0.55);
    }
    .result-winner-score {
      color: #fff;
      font-weight: 800;
    }
    .result-set-sep { opacity: 0.35; font-size: var(--font-size-lg); }

    /* Player result cards */
    .result-players {
      display: flex;
      align-items: center;
      gap: var(--space-5);
      justify-content: center;
    }
    .result-player {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      opacity: 0.55;
      position: relative;
    }
    .result-player.result-player-won { opacity: 1; }
    .result-player-name {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: rgba(255,255,255,0.8);
    }
    .result-crown {
      position: absolute;
      top: -18px;
      font-size: 20px;
      line-height: 1;
    }
    .result-vs {
      font-size: var(--font-size-sm);
      color: rgba(255,255,255,0.35);
      font-weight: var(--font-weight-bold);
    }

    /* Stats button */
    .stats-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      width: 100%;
      max-width: 300px;
      height: 52px;
      background: var(--color-primary);
      color: #fff;
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-bold);
      border-radius: var(--radius-full);
      box-shadow: 0 4px 16px rgba(0,122,255,0.4);
      transition: transform 0.1s, box-shadow 0.1s;
    }
    .stats-btn:active {
      transform: scale(0.97);
      box-shadow: 0 2px 8px rgba(0,122,255,0.3);
    }

    .back-matches-btn {
      color: rgba(255,255,255,0.45);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      padding: var(--space-3);
    }

    /* ── Loading ──────────────────────────────────────────────── */
    .loading-state {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: var(--space-4); color: rgba(255,255,255,0.6);
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

  // ── State ─────────────────────────────────────────────────────────────────
  matchLoaded   = signal(false);
  matchId       = signal('');
  p1Id          = signal('');
  p2Id          = signal('');
  p1Name        = signal('Player 1');
  p2Name        = signal('Player 2');
  locationCity  = signal<string | null>(null);
  serveNumber   = signal<1 | 2>(1);
  isSimpleMode  = signal(false);
  matchDbStatus = signal<string>('in_progress');

  showModal       = signal(false);
  modalWinnerId   = signal('');
  modalWinnerName = signal('');

  // ── Computed ──────────────────────────────────────────────────────────────

  /** True when no more scoring is allowed — match finished OR manually ended. */
  isLocked = computed(() =>
    this.scoring.isMatchComplete() ||
    this.matchDbStatus() === 'complete' ||
    this.matchDbStatus() === 'abandoned'
  );

  winnerName = computed(() => {
    const w = this.scoring.winner();
    if (!w) return '';
    return w === this.p1Id() ? this.p1Name() : this.p2Name();
  });

  setProgressLabel = computed(() => {
    const snap = this.scoring.snapshot();
    return `Set ${snap.currentSetIdx + 1}`;
  });

  setsWonArr(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  isCurrentSet(idx: number): boolean {
    const snap = this.scoring.snapshot();
    return !snap.isMatchComplete && idx === snap.setScores.length - 1;
  }

  // ── Subscription ref ──────────────────────────────────────────────────────
  private matchSub?: Subscription;

  // ── Persistence effect ────────────────────────────────────────────────────
  private persistEffect = effect(() => {
    const log    = this.scoring.pointsLog();
    const status = this.scoring.matchStatus();
    const id     = this.matchId();
    if (!id || !this.matchLoaded()) return;

    this.db.getDb()
      .then(db => db.matches.findOne(id).exec())
      .then(doc => {
        if (!doc) { console.warn('[Scoring] Cannot persist — match not found:', id); return; }
        return doc.patch({ points_log: log, status, _modified: new Date().toISOString() });
      })
      .catch(err => console.error('[Scoring] Persist failed:', err));
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    const id            = this.route.snapshot.paramMap.get('id') ?? '';
    const initialServer = this.route.snapshot.queryParamMap.get('server') ?? '';
    this.matchId.set(id);

    const db = await this.db.getDb();
    this.matchSub = db.matches.findOne(id).$
      .pipe(map(doc => (doc ? (doc.toJSON() as Match) : null)))
      .subscribe(async match => {
        if (!match) return;

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
        this.isSimpleMode.set(match.scoring_rules?.simple_scoring ?? false);
        this.matchDbStatus.set(match.status);

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
    this.matchSub?.unsubscribe();
    this.scoring.resetMatch();
  }

  // ── Tap handler — routes to simple or detail mode ─────────────────────────
  onSideTap(winnerId: string): void {
    if (this.isLocked()) return;

    if (this.isSimpleMode()) {
      this.recordSimplePoint(winnerId);
    } else {
      this.openModal(winnerId);
    }
  }

  // ── Simple mode: record point with sensible defaults ─────────────────────
  private recordSimplePoint(winnerId: string): void {
    this.scoring.recordPoint({
      server_id:     this.scoring.currentServer(),
      winner_id:     winnerId,
      shot_type:     'Winner',
      side:          'FH',
      shot_category: 'Regular',
      location:      'CC',
      serve_number:  this.serveNumber(),
      rally_length:  1
    });
    this.serveNumber.set(1);
  }

  // ── Detail modal ──────────────────────────────────────────────────────────
  openModal(winnerId: string): void {
    if (this.isLocked()) return;
    this.modalWinnerId.set(winnerId);
    this.modalWinnerName.set(winnerId === this.p1Id() ? this.p1Name() : this.p2Name());
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); }

  onPointRecorded(input: RecordPointInput): void {
    this.scoring.recordPoint({ ...input, serve_number: this.serveNumber() });
    this.closeModal();
    this.serveNumber.set(1);
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  undo(): void { this.scoring.undo(); }
  redo(): void { this.scoring.redo(); }

  viewStats(): void {
    this.router.navigate(['/matches', this.matchId(), 'stats']);
  }

  async endMatch(): Promise<void> {
    const id  = this.matchId();
    const db  = await this.db.getDb();
    const doc = await db.matches.findOne(id).exec();
    if (doc) {
      await doc.patch({ status: 'abandoned', _modified: new Date().toISOString() });
    }
    // Navigate to stats — match is now locked, stats screen shows the final state
    this.router.navigate(['/matches', id, 'stats']);
  }

  back(): void {
    this.router.navigate(['/matches']);
  }
}
