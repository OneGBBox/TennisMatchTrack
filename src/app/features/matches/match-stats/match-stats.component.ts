import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';

import { DatabaseService }       from '../../../core/services/database.service';
import { StatsService, MatchStats, MomentumPoint } from '../../../services/stats.service';
import { Match }                 from '../../../core/models/match.model';
import { Player }                from '../../../core/models/player.model';
import { PointLogEntry }         from '../../../core/models/point-log.model';
import { MomentumChartComponent } from './momentum-chart.component';

type Tab = 'overview' | 'shots' | 'log' | 'momentum';

// ── Default stats helper ─────────────────────────────────────────────────────
function emptyServeStats() {
  return { firstServeIn: 0, firstServeTotal: 0, firstServePct: 0, firstServeWon: 0, firstServeWonPct: 0, secondServeIn: 0, secondServeTotal: 0, secondServePct: 0, secondServeWon: 0, secondServeWonPct: 0, aces: 0, doubleFaults: 0 };
}
function emptyBreakPoints() {
  return { breakPointOpportunities: 0, breakPointsConverted: 0, breakPointsSaved: 0, conversionPct: 0 };
}
function emptyRally() {
  return { short: 0, medium: 0, long: 0, avg: 0 };
}
function emptyShots() {
  return { winners: 0, unforcedErrors: 0, forcedErrors: 0, winnersByFH: 0, winnersByBH: 0, winnersByServe: 0, ueBySide: { FH: 0, BH: 0, Serve: 0 } as Record<string, number>, byCategoryWin: {}, byCategoryErr: {} };
}
function emptyMatchStats(): MatchStats {
  const side = { serve: emptyServeStats(), breakPoints: emptyBreakPoints(), rally: emptyRally(), shots: emptyShots() as any, totalPoints: 0, pointsWon: 0, pointsWonPct: 0 };
  return { p1: side, p2: { ...side } };
}

@Component({
  selector: 'app-match-stats',
  standalone: true,
  imports: [MomentumChartComponent, DecimalPipe],
  template: `
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <header class="stats-header">
      <button class="back-btn" (click)="goBack()">‹ Back</button>
      <div class="header-info">
        <span class="players">{{ p1Name() }} vs {{ p2Name() }}</span>
        <span class="meta">{{ matchDate() }}</span>
      </div>
    </header>

    @if (loading()) {
      <div class="loading">Loading stats…</div>
    } @else if (!match()) {
      <div class="empty-state">Match not found.</div>
    } @else {
      <!-- ── Set filter chips ───────────────────────────────────────────────── -->
      <div class="set-filter">
        <button
          class="set-chip"
          [class.active]="activeSet() === null"
          (click)="setSet(null)">All</button>
        @for (s of availableSets(); track s) {
          <button
            class="set-chip"
            [class.active]="activeSet() === s"
            (click)="setSet(s)">Set {{ s }}</button>
        }
      </div>

      <!-- ── Tab bar ───────────────────────────────────────────────────────── -->
      <nav class="stats-tabs">
        <button [class.active]="tab() === 'overview'"  (click)="tab.set('overview')">Overview</button>
        <button [class.active]="tab() === 'shots'"     (click)="tab.set('shots')">Shots</button>
        <button [class.active]="tab() === 'log'"       (click)="tab.set('log')">Log</button>
        <button [class.active]="tab() === 'momentum'"  (click)="tab.set('momentum')">Momentum</button>
      </nav>

      <div class="stats-body">

        <!-- ══ OVERVIEW tab ══════════════════════════════════════════════════ -->
        @if (tab() === 'overview') {
          <div class="tab-pane">

            <!-- Points won -->
            <section class="stat-section">
              <h3 class="section-title">Points Won</h3>
              <div class="stat-row">
                <span class="val left">{{ stats().p1.pointsWon }}</span>
                <div class="bar-wrap">
                  <div class="bar p1" [style.width.%]="stats().p1.pointsWonPct"></div>
                  <div class="bar p2" [style.width.%]="stats().p2.pointsWonPct"></div>
                </div>
                <span class="val right">{{ stats().p2.pointsWon }}</span>
              </div>
              <div class="row-label">
                <span>{{ p1Name() }}</span><span>{{ p2Name() }}</span>
              </div>
            </section>

            <!-- Serve stats -->
            <section class="stat-section">
              <h3 class="section-title">Serve</h3>

              <div class="stat-row labeled">
                <span class="val left">{{ stats().p1.serve.firstServeIn }}/{{ stats().p1.serve.firstServeTotal }}</span>
                <span class="row-key">1st Serve In</span>
                <span class="val right">{{ stats().p2.serve.firstServeIn }}/{{ stats().p2.serve.firstServeTotal }}</span>
              </div>
              <div class="stat-row labeled">
                <span class="val left">{{ stats().p1.serve.firstServePct | number:'1.0-0' }}%</span>
                <span class="row-key">1st Serve %</span>
                <span class="val right">{{ stats().p2.serve.firstServePct | number:'1.0-0' }}%</span>
              </div>
              <div class="stat-row labeled">
                <span class="val left">{{ stats().p1.serve.firstServeWonPct | number:'1.0-0' }}%</span>
                <span class="row-key">Win on 1st %</span>
                <span class="val right">{{ stats().p2.serve.firstServeWonPct | number:'1.0-0' }}%</span>
              </div>
              <div class="stat-row labeled">
                <span class="val left">{{ stats().p1.serve.secondServeWonPct | number:'1.0-0' }}%</span>
                <span class="row-key">Win on 2nd %</span>
                <span class="val right">{{ stats().p2.serve.secondServeWonPct | number:'1.0-0' }}%</span>
              </div>
              <div class="stat-row labeled">
                <span class="val left">{{ stats().p1.serve.aces }}</span>
                <span class="row-key">Aces</span>
                <span class="val right">{{ stats().p2.serve.aces }}</span>
              </div>
              <div class="stat-row labeled">
                <span class="val left">{{ stats().p1.serve.doubleFaults }}</span>
                <span class="row-key">Double Faults</span>
                <span class="val right">{{ stats().p2.serve.doubleFaults }}</span>
              </div>
            </section>

            <!-- Break points -->
            <section class="stat-section">
              <h3 class="section-title">Break Points</h3>
              <div class="stat-row labeled">
                <span class="val left">{{ stats().p1.breakPoints?.breakPointsConverted }}/{{ stats().p1.breakPoints?.breakPointOpportunities }}</span>
                <span class="row-key">Converted</span>
                <span class="val right">{{ stats().p2.breakPoints?.breakPointsConverted }}/{{ stats().p2.breakPoints?.breakPointOpportunities }}</span>
              </div>
            </section>

            <!-- Rally lengths -->
            <section class="stat-section">
              <h3 class="section-title">Rally Lengths</h3>
              <div class="rally-grid">
                <div class="rally-bucket">
                  <span class="bucket-val">{{ stats().p1.rally?.short }}</span>
                  <span class="bucket-key">Short (1–4)</span>
                </div>
                <div class="rally-bucket">
                  <span class="bucket-val">{{ stats().p1.rally?.medium }}</span>
                  <span class="bucket-key">Medium (5–8)</span>
                </div>
                <div class="rally-bucket">
                  <span class="bucket-val">{{ stats().p1.rally?.long }}</span>
                  <span class="bucket-key">Long (9+)</span>
                </div>
                <div class="rally-bucket avg">
                  <span class="bucket-val">{{ stats().p1.rally?.avg }}</span>
                  <span class="bucket-key">Avg Rally</span>
                </div>
              </div>
            </section>

          </div>
        }

        <!-- ══ SHOTS tab ══════════════════════════════════════════════════════ -->
        @if (tab() === 'shots') {
          <div class="tab-pane">

            @for (player of [
              { id: match()!.player1_id, name: p1Name(), shots: stats().p1.shots },
              { id: match()!.player2_id, name: p2Name(), shots: stats().p2.shots }
            ]; track player.id) {
              <section class="stat-section">
                <h3 class="section-title">{{ player.name }}</h3>

                <div class="shot-summary">
                  <div class="shot-bubble winners">
                    <span class="bubble-val">{{ player.shots?.winners ?? 0 }}</span>
                    <span class="bubble-key">Winners</span>
                  </div>
                  <div class="shot-bubble ue">
                    <span class="bubble-val">{{ player.shots?.unforcedErrors ?? 0 }}</span>
                    <span class="bubble-key">Unforced</span>
                  </div>
                  <div class="shot-bubble fe">
                    <span class="bubble-val">{{ player.shots?.forcedErrors ?? 0 }}</span>
                    <span class="bubble-key">Forced</span>
                  </div>
                </div>

                <!-- Winners by side -->
                <div class="shot-row">
                  <span class="row-key">Winners by FH</span>
                  <span class="row-val">{{ player.shots?.winnersByFH ?? 0 }}</span>
                </div>
                <div class="shot-row">
                  <span class="row-key">Winners by BH</span>
                  <span class="row-val">{{ player.shots?.winnersByBH ?? 0 }}</span>
                </div>
                <div class="shot-row">
                  <span class="row-key">Winners by Serve</span>
                  <span class="row-val">{{ player.shots?.winnersByServe ?? 0 }}</span>
                </div>

                <!-- UE by side -->
                <div class="shot-row">
                  <span class="row-key">UE — Forehand</span>
                  <span class="row-val err">{{ player.shots?.ueBySide?.['FH'] ?? 0 }}</span>
                </div>
                <div class="shot-row">
                  <span class="row-key">UE — Backhand</span>
                  <span class="row-val err">{{ player.shots?.ueBySide?.['BH'] ?? 0 }}</span>
                </div>

                <!-- Top categories -->
                @if (topWinCategories(player.shots?.byCategoryWin ?? {}).length) {
                  <div class="category-list">
                    <span class="cat-header">Top winner types</span>
                    @for (c of topWinCategories(player.shots?.byCategoryWin ?? {}); track c.key) {
                      <div class="cat-row">
                        <span class="cat-key">{{ c.key }}</span>
                        <span class="cat-val">{{ c.val }}</span>
                      </div>
                    }
                  </div>
                }
              </section>
            }

          </div>
        }

        <!-- ══ LOG tab ════════════════════════════════════════════════════════ -->
        @if (tab() === 'log') {
          <div class="tab-pane log-pane">
            @if (filteredLog().length === 0) {
              <div class="empty-state">No points recorded yet.</div>
            } @else {
              <div class="log-list">
                @for (entry of filteredLog(); track $index; let i = $index) {
                  <div class="log-entry" [class.p1-won]="entry.winner_id === match()!.player1_id"
                                         [class.p2-won]="entry.winner_id === match()!.player2_id">
                    <div class="log-left">
                      <span class="log-idx">#{{ i + 1 }}</span>
                      <span class="log-score">S{{ entry.set_number }}·G{{ entry.game_number }}·P{{ entry.point_number }}</span>
                    </div>
                    <div class="log-center">
                      <span class="log-winner">
                        🎾 {{ entry.winner_id === match()!.player1_id ? p1Name() : p2Name() }}
                      </span>
                      <span class="log-detail">{{ entry.shot_type }} · {{ entry.shot_category }} · {{ entry.side }}</span>
                    </div>
                    <div class="log-right">
                      <span class="log-rally">{{ entry.rally_length }} shots</span>
                      <span class="log-loc">{{ entry.location }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- ══ MOMENTUM tab ═══════════════════════════════════════════════════ -->
        @if (tab() === 'momentum') {
          <div class="tab-pane momentum-pane">
            @if (momentumData().length === 0) {
              <div class="empty-state">Not enough data yet.</div>
            } @else {
              <div class="momentum-legend">
                <span class="leg-p1">↑ {{ p1Name() }}</span>
                <span class="leg-p2">↓ {{ p2Name() }}</span>
              </div>
              <app-momentum-chart
                [data]="momentumData()"
                [setBreaks]="setBreakIndices()"
                [p1Name]="p1Name()"
                [p2Name]="p2Name()" />

              <div class="momentum-summary">
                <div class="mom-stat">
                  <span class="mom-val">{{ peakP1Momentum() | number:'1.1-1' }}</span>
                  <span class="mom-key">{{ p1Name() }} Peak</span>
                </div>
                <div class="mom-stat">
                  <span class="mom-val">{{ peakP2Momentum() | number:'1.1-1' }}</span>
                  <span class="mom-key">{{ p2Name() }} Peak</span>
                </div>
                <div class="mom-stat">
                  <span class="mom-val">{{ longestRunP1() }}</span>
                  <span class="mom-key">{{ p1Name() }} Best Run</span>
                </div>
                <div class="mom-stat">
                  <span class="mom-val">{{ longestRunP2() }}</span>
                  <span class="mom-key">{{ p2Name() }} Best Run</span>
                </div>
              </div>
            }
          </div>
        }

      </div>
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--color-bg);
      color: var(--color-text);
      overflow: hidden;
    }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .stats-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
    }
    .back-btn {
      background: none;
      border: none;
      color: var(--color-accent);
      font-size: 1rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .back-btn:active { background: var(--color-border); }
    .header-info { display: flex; flex-direction: column; }
    .players { font-weight: 600; font-size: 0.95rem; }
    .meta { font-size: 0.75rem; color: var(--color-text-secondary); }

    /* ── Loading / empty ─────────────────────────────────────────────────── */
    .loading, .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: var(--color-text-secondary);
      font-size: 0.9rem;
    }

    /* ── Set filter ─────────────────────────────────────────────────────── */
    .set-filter {
      display: flex;
      gap: 6px;
      padding: 8px 16px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      overflow-x: auto;
      flex-shrink: 0;
    }
    .set-chip {
      padding: 4px 12px;
      border-radius: 12px;
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text-secondary);
      font-size: 0.8rem;
      cursor: pointer;
      white-space: nowrap;
    }
    .set-chip.active {
      background: var(--color-accent);
      color: #fff;
      border-color: var(--color-accent);
    }

    /* ── Tab bar ─────────────────────────────────────────────────────────── */
    .stats-tabs {
      display: flex;
      background: var(--color-surface);
      border-bottom: 2px solid var(--color-border);
      flex-shrink: 0;
    }
    .stats-tabs button {
      flex: 1;
      padding: 10px 0;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--color-text-secondary);
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      margin-bottom: -2px;
    }
    .stats-tabs button.active {
      color: var(--color-accent);
      border-bottom-color: var(--color-accent);
    }

    /* ── Body ────────────────────────────────────────────────────────────── */
    .stats-body {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .tab-pane { padding: 0 0 100px; }

    /* ── Stat sections ───────────────────────────────────────────────────── */
    .stat-section {
      padding: 16px;
      border-bottom: 1px solid var(--color-border);
    }
    .section-title {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-secondary);
      margin: 0 0 12px;
    }

    /* ── Dual comparison rows ────────────────────────────────────────────── */
    .stat-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .stat-row.labeled { justify-content: space-between; }
    .val { font-size: 0.9rem; font-weight: 600; min-width: 52px; }
    .val.left { text-align: right; color: var(--color-p1, #4FC3F7); }
    .val.right { text-align: left; color: var(--color-p2, #F48FB1); }
    .row-key {
      flex: 1;
      text-align: center;
      font-size: 0.75rem;
      color: var(--color-text-secondary);
    }
    .row-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      color: var(--color-text-secondary);
      margin-top: -4px;
      margin-bottom: 8px;
    }

    /* ── Progress bars ───────────────────────────────────────────────────── */
    .bar-wrap {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: var(--color-border);
      display: flex;
      overflow: hidden;
    }
    .bar.p1 {
      background: var(--color-p1, #4FC3F7);
      border-radius: 3px 0 0 3px;
    }
    .bar.p2 {
      background: var(--color-p2, #F48FB1);
      border-radius: 0 3px 3px 0;
    }

    /* ── Rally grid ──────────────────────────────────────────────────────── */
    .rally-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .rally-bucket {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: var(--color-surface-2, rgba(255,255,255,0.05));
      border-radius: 8px;
      padding: 8px 4px;
    }
    .bucket-val { font-size: 1.1rem; font-weight: 700; }
    .bucket-key { font-size: 0.65rem; color: var(--color-text-secondary); text-align: center; margin-top: 2px; }

    /* ── Shots tab ───────────────────────────────────────────────────────── */
    .shot-summary {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .shot-bubble {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 4px;
      border-radius: 10px;
    }
    .shot-bubble.winners { background: rgba(79,195,247,0.15); }
    .shot-bubble.ue      { background: rgba(239,83,80,0.15);  }
    .shot-bubble.fe      { background: rgba(255,167,38,0.15); }
    .bubble-val { font-size: 1.4rem; font-weight: 700; }
    .bubble-key { font-size: 0.65rem; color: var(--color-text-secondary); }

    .shot-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid var(--color-border);
      font-size: 0.83rem;
    }
    .row-val { font-weight: 600; }
    .row-val.err { color: #ef5350; }

    .category-list { margin-top: 10px; }
    .cat-header {
      display: block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-secondary);
      margin-bottom: 4px;
    }
    .cat-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.82rem;
      padding: 4px 0;
    }
    .cat-val { font-weight: 600; color: var(--color-accent); }

    /* ── Log tab ─────────────────────────────────────────────────────────── */
    .log-pane { padding: 0; }
    .log-list { display: flex; flex-direction: column; }
    .log-entry {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--color-border);
      font-size: 0.8rem;
    }
    .log-entry.p1-won { border-left: 3px solid var(--color-p1, #4FC3F7); }
    .log-entry.p2-won { border-left: 3px solid var(--color-p2, #F48FB1); }
    .log-left  { display: flex; flex-direction: column; width: 48px; flex-shrink: 0; }
    .log-center{ flex: 1; display: flex; flex-direction: column; }
    .log-right { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
    .log-idx   { font-weight: 700; }
    .log-score { font-size: 0.7rem; color: var(--color-text-secondary); }
    .log-winner{ font-weight: 600; }
    .log-detail{ color: var(--color-text-secondary); font-size: 0.72rem; }
    .log-rally { font-weight: 600; }
    .log-loc   { font-size: 0.72rem; color: var(--color-text-secondary); }

    /* ── Momentum tab ────────────────────────────────────────────────────── */
    .momentum-pane { padding: 16px 16px 100px; }
    .momentum-legend {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      margin-bottom: 8px;
    }
    .leg-p1 { color: var(--color-p1, #4FC3F7); }
    .leg-p2 { color: var(--color-p2, #F48FB1); }

    app-momentum-chart {
      display: block;
      margin-bottom: 20px;
    }

    .momentum-summary {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 16px;
    }
    .mom-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: var(--color-surface-2, rgba(255,255,255,0.05));
      border-radius: 10px;
      padding: 12px;
    }
    .mom-val { font-size: 1.3rem; font-weight: 700; }
    .mom-key { font-size: 0.7rem; color: var(--color-text-secondary); margin-top: 2px; }
  `]
})
export class MatchStatsComponent implements OnInit, OnDestroy {
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly db     = inject(DatabaseService);
  private readonly statsSvc = inject(StatsService);
  private sub?: Subscription;

  // ── State signals ─────────────────────────────────────────────────────────
  loading = signal(true);
  match   = signal<Match | null>(null);
  player1 = signal<Player | null>(null);
  player2 = signal<Player | null>(null);
  tab     = signal<Tab>('overview');
  activeSet = signal<number | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  p1Name = computed(() => this.player1()?.name ?? 'Player 1');
  p2Name = computed(() => this.player2()?.name ?? 'Player 2');

  matchDate = computed(() => {
    const m = this.match();
    if (!m) return '';
    return new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  });

  availableSets = computed(() => {
    const log = this.match()?.points_log ?? [];
    const nums = new Set(log.map(p => p.set_number));
    return Array.from(nums).sort((a, b) => a - b);
  });

  filteredLog = computed<PointLogEntry[]>(() => {
    const log  = this.match()?.points_log ?? [];
    const s    = this.activeSet();
    return s === null ? log : log.filter(p => p.set_number === s);
  });

  hasStats = computed<boolean>(() => {
    const m = this.match();
    return !!m && m.points_log.length > 0;
  });

  stats = computed<MatchStats>(() => {
    const m = this.match();
    if (!m || m.points_log.length === 0) return emptyMatchStats();
    return this.statsSvc.getMatchStats(
      m.points_log,
      m.player1_id,
      m.player2_id,
      this.activeSet() ?? undefined
    );
  });

  momentumData = computed<MomentumPoint[]>(() => {
    const log = this.filteredLog();
    if (log.length < 2) return [];
    return this.statsSvc.getMomentumSeries(log, 5);
  });

  setBreakIndices = computed<number[]>(() => {
    const log = this.filteredLog();
    const breaks: number[] = [];
    for (let i = 1; i < log.length; i++) {
      if (log[i].set_number !== log[i - 1].set_number) breaks.push(i);
    }
    return breaks;
  });

  peakP1Momentum = computed(() => {
    const pts = this.momentumData();
    if (!pts.length) return 0;
    return Math.max(...pts.map(p => p.ema));
  });
  peakP2Momentum = computed(() => {
    const pts = this.momentumData();
    if (!pts.length) return 0;
    return Math.abs(Math.min(...pts.map(p => p.ema)));
  });

  longestRunP1 = computed(() => this.longestConsecutiveRun(true));
  longestRunP2 = computed(() => this.longestConsecutiveRun(false));

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    const matchId = this.route.snapshot.paramMap.get('id');
    if (!matchId) { this.router.navigate(['/matches']); return; }

    const db = await this.db.getDb();

    this.sub = combineLatest([
      db.matches.findOne(matchId).$,
      db.players.find({ selector: { _deleted: { $ne: true } } }).$
    ]).subscribe(([matchDoc, playerDocs]) => {
      const m = matchDoc?.toJSON() as Match | null;
      this.match.set(m ?? null);

      if (m) {
        const players = playerDocs.map(d => d.toJSON() as Player);
        this.player1.set(players.find(p => p.id === m.player1_id) ?? null);
        this.player2.set(players.find(p => p.id === m.player2_id) ?? null);
      }
      this.loading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  goBack(): void {
    this.router.navigate(['/matches']);
  }

  setSet(s: number | null): void {
    this.activeSet.set(s);
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  topWinCategories(map: Partial<Record<string, number>>): { key: string; val: number }[] {
    return Object.entries(map)
      .map(([key, val]) => ({ key, val: val ?? 0 }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 4);
  }

  private longestConsecutiveRun(forP1: boolean): number {
    const log = this.filteredLog();
    const m   = this.match();
    if (!m) return 0;
    const targetId = forP1 ? m.player1_id : m.player2_id;
    let max = 0, cur = 0;
    for (const p of log) {
      if (p.winner_id === targetId) { cur++; max = Math.max(max, cur); }
      else cur = 0;
    }
    return max;
  }
}
