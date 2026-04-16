import {
  Component, OnInit, signal, computed, inject
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';

import { DatabaseService } from '../../../core/services/database.service';
import { WeatherService, WeatherResult } from '../../../core/services/weather.service';
import { Player } from '../../../core/models/player.model';
import { MatchFormat } from '../../../core/models/scoring-rules.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { v4 as uuidv4 } from 'uuid';

interface FormatOption {
  value: MatchFormat;
  label: string;
  description: string;
}

@Component({
  selector: 'app-new-match',
  standalone: true,
  imports: [FormsModule, AvatarComponent],
  template: `
    <div class="page">

      <!-- ── Nav bar ──────────────────────────────────────────── -->
      <header class="nav-bar">
        <button class="nav-back" (click)="cancel()" aria-label="Cancel">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 1 1 9 9 17"/>
          </svg>
        </button>
        <h1 class="nav-title">New Match</h1>
        <button
          class="nav-start"
          [disabled]="!canStart()"
          (click)="startMatch()"
        >
          Start
        </button>
      </header>

      <!-- ── Scrollable form ───────────────────────────────────── -->
      <div class="page-content form-content">

        <!-- Players section -->
        <section class="form-section">
          <h2 class="section-label">Players</h2>

          <!-- Player 1 -->
          <div class="player-selector" [class.selected]="player1Id()">
            <div class="selector-label">Player 1</div>
            <div class="selector-body">
              @if (selectedPlayer1()) {
                <div class="selected-player">
                  <app-avatar [name]="selectedPlayer1()!.name" [size]="40" />
                  <span class="sel-name">{{ selectedPlayer1()!.name }}</span>
                  <button class="sel-clear" (click)="player1Id.set('')" aria-label="Clear">✕</button>
                </div>
              } @else {
                <select class="player-select" [(ngModel)]="p1IdModel" (ngModelChange)="player1Id.set($event)">
                  <option value="">— Select player —</option>
                  @for (p of availablePlayers1(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              }
            </div>
          </div>

          <!-- VS divider -->
          <div class="vs-divider">vs</div>

          <!-- Player 2 -->
          <div class="player-selector" [class.selected]="player2Id()">
            <div class="selector-label">Player 2</div>
            <div class="selector-body">
              @if (selectedPlayer2()) {
                <div class="selected-player">
                  <app-avatar [name]="selectedPlayer2()!.name" [size]="40" />
                  <span class="sel-name">{{ selectedPlayer2()!.name }}</span>
                  <button class="sel-clear" (click)="player2Id.set('')" aria-label="Clear">✕</button>
                </div>
              } @else {
                <select class="player-select" [(ngModel)]="p2IdModel" (ngModelChange)="player2Id.set($event)">
                  <option value="">— Select player —</option>
                  @for (p of availablePlayers2(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              }
            </div>
          </div>

          <button class="add-player-btn" (click)="addPlayer()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add new player
          </button>
        </section>

        <!-- Format section -->
        <section class="form-section">
          <h2 class="section-label">Format</h2>
          <div class="format-grid">
            @for (f of formats; track f.value) {
              <button
                class="format-card"
                [class.active]="format() === f.value"
                (click)="format.set(f.value)"
              >
                <span class="format-name">{{ f.label }}</span>
                <span class="format-desc">{{ f.description }}</span>
              </button>
            }
          </div>
        </section>

        <!-- Rules section -->
        <section class="form-section">
          <h2 class="section-label">Rules</h2>

          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Simple Scoring</span>
              <span class="toggle-sub">Tap to score — no shot details required</span>
            </div>
            <button
              class="toggle"
              [class.on]="simpleScoring()"
              (click)="toggleSimpleScoring()"
              [attr.aria-pressed]="simpleScoring()"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">No-Advantage</span>
              <span class="toggle-sub">Deciding point at deuce</span>
            </div>
            <button
              class="toggle"
              [class.on]="noAd()"
              (click)="toggleNoAd()"
              [attr.aria-pressed]="noAd()"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>

          @if (showFinalSetTb()) {
            <div class="toggle-row">
              <div class="toggle-info">
                <span class="toggle-label">Final Set Tiebreak</span>
                <span class="toggle-sub">10-point super tiebreak in final set</span>
              </div>
              <button
                class="toggle"
                [class.on]="finalSetTb()"
                (click)="toggleFinalSetTb()"
                [attr.aria-pressed]="finalSetTb()"
              >
                <span class="toggle-thumb"></span>
              </button>
            </div>
          }
        </section>

        <!-- Server section -->
        <section class="form-section">
          <h2 class="section-label">Who Serves First?</h2>
          <div class="server-options">
            @if (selectedPlayer1()) {
              <button
                class="server-btn"
                [class.active]="initialServer() === player1Id()"
                (click)="initialServer.set(player1Id())"
              >
                <app-avatar [name]="selectedPlayer1()!.name" [size]="32" />
                <span>{{ selectedPlayer1()!.name }}</span>
              </button>
            }
            @if (selectedPlayer2()) {
              <button
                class="server-btn"
                [class.active]="initialServer() === player2Id()"
                (click)="initialServer.set(player2Id())"
              >
                <app-avatar [name]="selectedPlayer2()!.name" [size]="32" />
                <span>{{ selectedPlayer2()!.name }}</span>
              </button>
            }
          </div>
        </section>

        <!-- Details section -->
        <section class="form-section">
          <h2 class="section-label">Details (optional)</h2>

          <label class="field-label">
            City / Location
            <div class="city-row">
              <input
                class="field-input city-input"
                type="text"
                [(ngModel)]="locationCity"
                placeholder="e.g. New York"
                (blur)="onCityBlur()"
              />
              @if (weatherLoading()) {
                <span class="weather-spinner"></span>
              }
            </div>
          </label>

          <!-- Weather preview chip -->
          @if (weatherResult()) {
            <div class="weather-preview">
              <span class="w-icon">{{ weatherIcon() }}</span>
              <span class="w-city">{{ weatherResult()!.cityName }}</span>
              <span class="w-temp">{{ weatherResult()!.weather.temp_c }}°C</span>
              <span class="w-cond">{{ weatherResult()!.weather.condition }}</span>
              <span class="w-wind">💨 {{ weatherResult()!.weather.wind_kph }} km/h</span>
            </div>
          }
          @if (weatherError()) {
            <p class="weather-error">{{ weatherError() }}</p>
          }

          <label class="field-label">
            Date
            <input
              class="field-input"
              type="date"
              [(ngModel)]="matchDate"
            />
          </label>
        </section>

        <!-- Bottom padding -->
        <div style="height: 32px"></div>
      </div>
    </div>
  `,
  styles: [`
    /* ── Nav ──────────────────────────────────────────────────── */
    .nav-bar {
      display: flex;
      align-items: center;
      padding: var(--space-4);
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border-subtle);
      gap: var(--space-3);
    }
    .nav-back {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      color: var(--color-primary);
    }
    .nav-title {
      flex: 1;
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-bold);
      text-align: center;
      color: var(--color-text-primary);
    }
    .nav-start {
      color: var(--color-primary);
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-bold);
      min-width: 44px;
      text-align: right;
      opacity: 1;
      transition: opacity 0.15s;
    }
    .nav-start:disabled {
      opacity: 0.35;
      cursor: default;
    }

    /* ── Form ─────────────────────────────────────────────────── */
    .form-content { padding: var(--space-4); }
    .form-section {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border-subtle);
      padding: var(--space-4);
      margin-bottom: var(--space-4);
    }
    .section-label {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: var(--space-3);
    }

    /* ── Player selectors ─────────────────────────────────────── */
    .player-selector {
      border-radius: var(--radius-md);
      border: 1.5px solid var(--color-border);
      overflow: hidden;
      margin-bottom: var(--space-2);
      transition: border-color 0.15s;
    }
    .player-selector.selected { border-color: var(--color-primary); }
    .selector-label {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-muted);
      padding: var(--space-2) var(--space-3) 0;
    }
    .selector-body { padding: var(--space-2) var(--space-3) var(--space-3); }
    .player-select {
      width: 100%;
      border: none;
      background: transparent;
      font-size: var(--font-size-base);
      color: var(--color-text-primary);
      font-family: var(--font-family);
      outline: none;
      cursor: pointer;
    }
    .selected-player {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .sel-name {
      flex: 1;
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }
    .sel-clear {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      padding: var(--space-1);
    }
    .vs-divider {
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      letter-spacing: 1px;
      margin: var(--space-2) 0;
    }
    .add-player-btn {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-primary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      margin-top: var(--space-3);
      padding: var(--space-2) 0;
    }

    /* ── Format grid ──────────────────────────────────────────── */
    .format-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-2);
    }
    .format-card {
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-3) var(--space-2);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      transition: border-color 0.15s, background 0.15s;
    }
    .format-card.active {
      border-color: var(--color-primary);
      background: rgba(0,122,255,0.08);
    }
    .format-name {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }
    .format-card.active .format-name { color: var(--color-primary); }
    .format-desc {
      font-size: 10px;
      color: var(--color-text-muted);
      text-align: center;
      line-height: 1.3;
    }

    /* ── Toggle ───────────────────────────────────────────────── */
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) 0;
      border-bottom: 1px solid var(--color-border-subtle);
    }
    .toggle-row:last-child { border-bottom: none; }
    .toggle-info { display: flex; flex-direction: column; gap: 2px; }
    .toggle-label {
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }
    .toggle-sub {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }
    .toggle {
      width: 51px; height: 31px;
      border-radius: var(--radius-full);
      background: var(--color-border);
      position: relative;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .toggle.on { background: var(--color-primary); }
    .toggle-thumb {
      position: absolute;
      top: 2px; left: 2px;
      width: 27px; height: 27px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      transition: transform 0.2s;
    }
    .toggle.on .toggle-thumb { transform: translateX(20px); }

    /* ── Server buttons ───────────────────────────────────────── */
    .server-options {
      display: flex;
      gap: var(--space-3);
    }
    .server-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-4) var(--space-2);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      transition: border-color 0.15s, background 0.15s;
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      font-weight: var(--font-weight-medium);
    }
    .server-btn.active {
      border-color: var(--color-accent);
      background: rgba(240,180,41,0.10);
    }

    /* ── Fields ───────────────────────────────────────────────── */
    .field-label {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
      font-weight: var(--font-weight-medium);
      margin-bottom: var(--space-3);
    }
    .field-input {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-3) var(--space-3);
      font-size: var(--font-size-base);
      font-family: var(--font-family);
      color: var(--color-text-primary);
      background: var(--color-bg);
      outline: none;
      transition: border-color 0.15s;
    }
    .field-input:focus { border-color: var(--color-primary); }

    /* ── City + weather ───────────────────────────────────────── */
    .city-row {
      position: relative;
      display: flex;
      align-items: center;
    }
    .city-input { flex: 1; }
    .weather-spinner {
      position: absolute;
      right: var(--space-3);
      width: 16px; height: 16px;
      border: 2px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .weather-preview {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      background: rgba(0,122,255,0.07);
      border: 1px solid rgba(0,122,255,0.2);
      border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3);
      font-size: var(--font-size-sm);
      flex-wrap: wrap;
    }
    .w-icon  { font-size: 18px; line-height: 1; }
    .w-city  { font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
    .w-temp  { color: var(--color-primary); font-weight: var(--font-weight-bold); }
    .w-cond  { color: var(--color-text-secondary); }
    .w-wind  { color: var(--color-text-muted); margin-left: auto; }

    .weather-error {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      padding: var(--space-1) var(--space-1);
    }
  `]
})
export class NewMatchComponent implements OnInit {
  private db      = inject(DatabaseService);
  private router  = inject(Router);
  private weather = inject(WeatherService);

  // ── State ────────────────────────────────────────────────────────────────
  players       = signal<Player[]>([]);
  player1Id     = signal<string>('');
  player2Id     = signal<string>('');
  format        = signal<MatchFormat>('best_of_3');
  noAd          = signal(false);
  finalSetTb    = signal(true);
  simpleScoring = signal(true);   // default ON — easier for casual use
  initialServer = signal<string>('');

  locationCity   = '';
  matchDate      = new Date().toISOString().split('T')[0];

  // ── Weather ───────────────────────────────────────────────────────────────
  weatherLoading = signal(false);
  weatherResult  = signal<WeatherResult | null>(null);
  weatherError   = signal('');

  weatherIcon = () => {
    const r = this.weatherResult();
    return r ? WeatherService.icon(r.weather.condition) : '';
  };

  // NgModel bridges (two-way bind into signals)
  get p1IdModel(): string { return this.player1Id(); }
  set p1IdModel(v: string) { this.player1Id.set(v); }
  get p2IdModel(): string { return this.player2Id(); }
  set p2IdModel(v: string) { this.player2Id.set(v); }

  // ── Computed ─────────────────────────────────────────────────────────────
  selectedPlayer1 = computed(() =>
    this.players().find(p => p.id === this.player1Id()) ?? null
  );
  selectedPlayer2 = computed(() =>
    this.players().find(p => p.id === this.player2Id()) ?? null
  );
  availablePlayers1 = computed(() =>
    this.players().filter(p => p.id !== this.player2Id())
  );
  availablePlayers2 = computed(() =>
    this.players().filter(p => p.id !== this.player1Id())
  );

  showFinalSetTb = computed(() =>
    this.format() === 'best_of_3' || this.format() === 'best_of_5'
  );

  canStart = computed(() =>
    !!this.player1Id() &&
    !!this.player2Id() &&
    !!this.initialServer()
  );

  // ── Format options ────────────────────────────────────────────────────────
  readonly formats: FormatOption[] = [
    { value: 'best_of_1', label: 'Best of 1', description: 'One set' },
    { value: 'best_of_3', label: 'Best of 3', description: 'First to 2 sets' },
    { value: 'best_of_5', label: 'Best of 5', description: 'First to 3 sets' },
    { value: 'pro_set',   label: 'Pro Set',   description: 'First to 8 games' },
    { value: 'fast4',     label: 'Fast4',     description: 'First to 4 games' },
    { value: 'super_tiebreak', label: 'Super TB', description: '2 sets + super TB' }
  ];

  // ── Toggle helpers (arrow functions not allowed in Angular templates) ────
  toggleNoAd(): void          { this.noAd.update(v => !v); }
  toggleFinalSetTb(): void    { this.finalSetTb.update(v => !v); }
  toggleSimpleScoring(): void { this.simpleScoring.update(v => !v); }

  async onCityBlur(): Promise<void> {
    const city = this.locationCity.trim();
    // Clear previous result if city was cleared
    if (!city) { this.weatherResult.set(null); this.weatherError.set(''); return; }
    // Skip if result already matches current city
    if (this.weatherResult()?.cityName.toLowerCase() === city.toLowerCase()) return;

    this.weatherLoading.set(true);
    this.weatherError.set('');
    this.weatherResult.set(null);

    const result = await this.weather.fetchForCity(city);

    if (result) {
      this.weatherResult.set(result);
      // Update the city field to the geocoder-resolved name
      this.locationCity = result.cityName;
    } else {
      this.weatherError.set('Could not fetch weather — city not found or offline.');
    }
    this.weatherLoading.set(false);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    const db = await this.db.getDb();
    db.players.find({ selector: { _deleted: { $ne: true } } }).sort({ name: 'asc' }).$
      .pipe(map(docs => docs.map(d => d.toJSON() as Player)))
      .subscribe(ps => this.players.set(ps));
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async startMatch(): Promise<void> {
    if (!this.canStart()) return;

    const matchId = uuidv4();

    try {
      const wx = this.weatherResult();
      await this.db.upsertMatch({
        id: matchId,
        date: this.matchDate,
        location_city: this.locationCity || undefined,
        weather:       wx ? wx.weather : undefined,
        player1_id:    this.player1Id(),
        player2_id:    this.player2Id(),
        points_log:    [],
        status:        'setup',
        scoring_rules: {
          format:                this.format(),
          no_ad:                 this.noAd(),
          final_set_tiebreak:    this.finalSetTb(),
          super_tiebreak_points: 10,
          simple_scoring:        this.simpleScoring()
        }
      } as any);
    } catch (err) {
      console.error('[NewMatch] Failed to save match:', err);
      alert('Could not create match — see console for details.');
      return;
    }

    // Navigate to scoring screen, passing initial server as query param
    this.router.navigate(['/matches', matchId, 'score'], {
      queryParams: { server: this.initialServer() }
    });
  }

  cancel(): void {
    this.router.navigate(['/matches']);
  }

  addPlayer(): void {
    this.router.navigate(['/players', 'new'], {
      queryParams: { returnTo: '/matches/new' }
    });
  }
}
