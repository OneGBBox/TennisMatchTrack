import {
  Component, input, output, signal, computed
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ShotResult,
  ShotSide,
  ShotCategory,
  ShotLocation
} from '../../../core/models/point-log.model';
import { RecordPointInput } from '../../../services/tennis-scoring.service';

// Categories available per side
const SIDE_CATEGORIES: Record<ShotSide, ShotCategory[]> = {
  Serve: ['Ace', 'Double Fault', 'Regular'],
  FH:    ['Regular', 'Inside-In', 'Inside-Out', 'Passing', 'Approach', 'Slice', 'Lob', 'Drop Shot', 'Overhead'],
  BH:    ['Regular', 'Return', 'Passing', 'Approach', 'Slice', 'Lob', 'Drop Shot', 'Volley']
};

const LOCATIONS: ShotLocation[] = ['CC', 'ML', 'DTL', 'T', 'Wide', 'Body', 'Net'];
const LOCATION_LABEL: Record<ShotLocation, string> = {
  CC: 'Cross Court', ML: 'Middle', DTL: 'Down the Line',
  T: 'T (Serve)', Wide: 'Wide', Body: 'Body', Net: 'Net'
};

@Component({
  selector: 'app-point-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <!-- Backdrop -->
    <div class="backdrop" (click)="dismiss()"></div>

    <!-- Sheet -->
    <div class="sheet" role="dialog" aria-modal="true" [attr.aria-label]="'Record point for ' + winnerName()">

      <!-- Handle -->
      <div class="handle"></div>

      <!-- Header -->
      <div class="sheet-header">
        <button class="sheet-cancel" (click)="dismiss()">Cancel</button>
        <h2 class="sheet-title">{{ winnerName() }} won the point</h2>
        <button
          class="sheet-done"
          [disabled]="!canSubmit()"
          (click)="submit()"
        >Done</button>
      </div>

      <!-- Step indicator -->
      <div class="steps">
        @for (s of STEPS; track s.index) {
          <div
            class="step-dot"
            [class.active]="currentStep() === s.index"
            [class.done]="currentStep() > s.index"
          ></div>
        }
      </div>

      <!-- ── Step 1: Result ──────────────────────────────────── -->
      @if (currentStep() === 0) {
        <div class="step-content">
          <h3 class="step-label">Result</h3>
          <div class="btn-group">
            @for (r of RESULTS; track r.value) {
              <button
                class="choice-btn"
                [class.active]="result() === r.value"
                [style.--accent]="r.color"
                (click)="selectResult(r.value)"
              >
                <span class="choice-icon">{{ r.icon }}</span>
                <span class="choice-label">{{ r.label }}</span>
                <span class="choice-sub">{{ r.sub }}</span>
              </button>
            }
          </div>
        </div>
      }

      <!-- ── Step 2: Side ────────────────────────────────────── -->
      @if (currentStep() === 1) {
        <div class="step-content">
          <h3 class="step-label">Shot Side</h3>
          <div class="btn-group">
            @for (s of SIDES; track s.value) {
              <button
                class="choice-btn"
                [class.active]="side() === s.value"
                (click)="selectSide(s.value)"
              >
                <span class="choice-icon">{{ s.icon }}</span>
                <span class="choice-label">{{ s.label }}</span>
              </button>
            }
          </div>
        </div>
      }

      <!-- ── Step 3: Shot Category ───────────────────────────── -->
      @if (currentStep() === 2) {
        <div class="step-content">
          <h3 class="step-label">Shot Type</h3>
          <div class="category-grid">
            @for (c of availableCategories(); track c) {
              <button
                class="cat-btn"
                [class.active]="shotCategory() === c"
                (click)="selectCategory(c)"
              >{{ c }}</button>
            }
          </div>
        </div>
      }

      <!-- ── Step 4: Location ────────────────────────────────── -->
      @if (currentStep() === 3) {
        <div class="step-content">
          <h3 class="step-label">Location</h3>
          <div class="location-grid">
            @for (loc of LOCATIONS; track loc) {
              <button
                class="loc-btn"
                [class.active]="location() === loc"
                (click)="selectLocation(loc)"
              >
                <span class="loc-code">{{ loc }}</span>
                <span class="loc-label">{{ LOCATION_LABEL[loc] }}</span>
              </button>
            }
          </div>
        </div>
      }

      <!-- ── Rally Length (always visible) ─────────────────── -->
      <div class="rally-section">
        <div class="rally-header">
          <span class="rally-label">Rally Length</span>
          <span class="rally-value">{{ rallyLength() }} shots</span>
        </div>
        <input
          class="rally-slider"
          type="range"
          min="1" max="30"
          [ngModel]="rallyLength()"
          (ngModelChange)="rallyLength.set($event)"
        />
        <div class="rally-ticks">
          <span>1</span><span>10</span><span>20</span><span>30</span>
        </div>
      </div>

      <!-- ── Serve number (only when side = Serve) ─────────── -->
      @if (side() === 'Serve') {
        <div class="serve-toggle-section">
          <span class="serve-toggle-label">Serve Number</span>
          <div class="serve-toggle">
            <button
              [class.active]="serveNumber() === 1"
              (click)="serveNumber.set(1)"
            >1st</button>
            <button
              [class.active]="serveNumber() === 2"
              (click)="serveNumber.set(2)"
            >2nd</button>
          </div>
        </div>
      }

      <!-- Navigation buttons -->
      <div class="nav-row">
        @if (currentStep() > 0) {
          <button class="nav-btn back" (click)="prevStep()">← Back</button>
        } @else {
          <div></div>
        }
        @if (currentStep() < 3) {
          <button
            class="nav-btn next"
            [disabled]="!stepComplete()"
            (click)="nextStep()"
          >Next →</button>
        } @else {
          <button
            class="nav-btn submit"
            [disabled]="!canSubmit()"
            (click)="submit()"
          >Record Point</button>
        }
      </div>

    </div>
  `,
  styles: [`
    /* ── Backdrop ─────────────────────────────────────────────── */
    .backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 200;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* ── Sheet ────────────────────────────────────────────────── */
    .sheet {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      background: var(--color-surface);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      z-index: 201;
      padding-bottom: calc(var(--safe-bottom) + var(--space-4));
      animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
      max-height: 90vh;
      overflow-y: auto;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }

    /* ── Handle ───────────────────────────────────────────────── */
    .handle {
      width: 36px; height: 4px;
      background: var(--color-border);
      border-radius: var(--radius-full);
      margin: var(--space-3) auto var(--space-2);
    }

    /* ── Header ───────────────────────────────────────────────── */
    .sheet-header {
      display: flex;
      align-items: center;
      padding: 0 var(--space-4) var(--space-3);
      gap: var(--space-3);
    }
    .sheet-cancel, .sheet-done {
      font-size: var(--font-size-base);
      min-width: 56px;
    }
    .sheet-cancel { color: var(--color-text-muted); text-align: left; }
    .sheet-done   { color: var(--color-primary); font-weight: var(--font-weight-bold); text-align: right; }
    .sheet-done:disabled { opacity: 0.35; cursor: default; }
    .sheet-title {
      flex: 1;
      text-align: center;
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }

    /* ── Steps ────────────────────────────────────────────────── */
    .steps {
      display: flex;
      justify-content: center;
      gap: var(--space-2);
      padding: 0 var(--space-4) var(--space-3);
    }
    .step-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--color-border);
      transition: background 0.2s, transform 0.2s;
    }
    .step-dot.active {
      background: var(--color-primary);
      transform: scale(1.3);
    }
    .step-dot.done { background: var(--color-primary); opacity: 0.5; }

    /* ── Step content ─────────────────────────────────────────── */
    .step-content { padding: 0 var(--space-4) var(--space-4); }
    .step-label {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: var(--space-3);
    }

    /* ── Choice buttons (Result / Side) ───────────────────────── */
    .btn-group {
      display: flex;
      gap: var(--space-3);
    }
    .choice-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: var(--space-4) var(--space-2);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-lg);
      transition: border-color 0.15s, background 0.15s;
    }
    .choice-btn.active {
      border-color: var(--accent, var(--color-primary));
      background: color-mix(in srgb, var(--accent, var(--color-primary)) 10%, transparent);
    }
    .choice-icon { font-size: 26px; line-height: 1; }
    .choice-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }
    .choice-sub {
      font-size: 10px;
      color: var(--color-text-muted);
      text-align: center;
    }

    /* ── Category grid ────────────────────────────────────────── */
    .category-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-2);
    }
    .cat-btn {
      padding: var(--space-3) var(--space-2);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      text-align: center;
      transition: border-color 0.15s, background 0.15s;
    }
    .cat-btn.active {
      border-color: var(--color-primary);
      background: rgba(0,122,255,0.10);
      color: var(--color-primary);
      font-weight: var(--font-weight-bold);
    }

    /* ── Location grid ────────────────────────────────────────── */
    .location-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-2);
    }
    .loc-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: var(--space-3);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      transition: border-color 0.15s, background 0.15s;
    }
    .loc-btn.active {
      border-color: var(--color-primary);
      background: rgba(0,122,255,0.10);
    }
    .loc-code {
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }
    .loc-btn.active .loc-code { color: var(--color-primary); }
    .loc-label {
      font-size: 10px;
      color: var(--color-text-muted);
      text-align: center;
    }

    /* ── Rally section ────────────────────────────────────────── */
    .rally-section {
      padding: 0 var(--space-4) var(--space-4);
      border-top: 1px solid var(--color-border-subtle);
    }
    .rally-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) 0 var(--space-2);
    }
    .rally-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-muted);
    }
    .rally-value {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      color: var(--color-primary);
    }
    .rally-slider {
      width: 100%;
      accent-color: var(--color-primary);
      height: 4px;
    }
    .rally-ticks {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: var(--color-text-muted);
      margin-top: 4px;
    }

    /* ── Serve toggle ─────────────────────────────────────────── */
    .serve-toggle-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-4) var(--space-4);
    }
    .serve-toggle-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-muted);
    }
    .serve-toggle {
      display: flex;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .serve-toggle button {
      padding: var(--space-2) var(--space-4);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-muted);
      background: transparent;
      transition: background 0.15s, color 0.15s;
    }
    .serve-toggle button.active {
      background: var(--color-primary);
      color: #fff;
    }

    /* ── Nav row ──────────────────────────────────────────────── */
    .nav-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) var(--space-4) 0;
    }
    .nav-btn {
      padding: var(--space-3) var(--space-5);
      border-radius: var(--radius-full);
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
      min-height: 44px;
    }
    .nav-btn.back {
      color: var(--color-text-muted);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
    }
    .nav-btn.next, .nav-btn.submit {
      background: var(--color-primary);
      color: #fff;
    }
    .nav-btn.submit { background: var(--color-win); }
    .nav-btn:disabled { opacity: 0.35; cursor: default; }
  `]
})
export class PointModalComponent {
  // ── Inputs / Outputs ─────────────────────────────────────────────────────
  winnerId   = input.required<string>();
  serverId   = input.required<string>();
  winnerName = input.required<string>();

  recorded = output<RecordPointInput>();
  cancelled = output<void>();

  // ── Constants ─────────────────────────────────────────────────────────────
  readonly STEPS = [
    { index: 0, label: 'Result' },
    { index: 1, label: 'Side' },
    { index: 2, label: 'Category' },
    { index: 3, label: 'Location' }
  ];

  readonly RESULTS: { value: ShotResult; label: string; sub: string; icon: string; color: string }[] = [
    { value: 'Winner', label: 'Winner',         sub: 'Clean winner',      icon: '🏆', color: '#34C759' },
    { value: 'UE',     label: 'Unforced Error', sub: 'Missed clean shot', icon: '😬', color: '#FF9500' },
    { value: 'FE',     label: 'Forced Error',   sub: 'Error under pressure', icon: '💪', color: '#007AFF' }
  ];

  readonly SIDES: { value: ShotSide; label: string; icon: string }[] = [
    { value: 'FH',    label: 'Forehand', icon: '🤜' },
    { value: 'BH',    label: 'Backhand', icon: '🤛' },
    { value: 'Serve', label: 'Serve',    icon: '🎾' }
  ];

  readonly LOCATIONS  = LOCATIONS;
  readonly LOCATION_LABEL = LOCATION_LABEL;

  // ── Step state ─────────────────────────────────────────────────────────────
  currentStep   = signal(0);
  result        = signal<ShotResult | null>(null);
  side          = signal<ShotSide | null>(null);
  shotCategory  = signal<ShotCategory | null>(null);
  location      = signal<ShotLocation | null>(null);
  rallyLength   = signal(1);
  serveNumber   = signal<1 | 2>(1);

  availableCategories = computed<ShotCategory[]>(() => {
    const s = this.side();
    return s ? SIDE_CATEGORIES[s] : [];
  });

  stepComplete = computed(() => {
    switch (this.currentStep()) {
      case 0: return this.result() !== null;
      case 1: return this.side() !== null;
      case 2: return this.shotCategory() !== null;
      case 3: return this.location() !== null;
      default: return false;
    }
  });

  canSubmit = computed(() =>
    this.result() !== null &&
    this.side() !== null &&
    this.shotCategory() !== null &&
    this.location() !== null
  );

  // ── Step navigation ────────────────────────────────────────────────────────
  selectResult(r: ShotResult): void {
    this.result.set(r);
    this.nextStep();
  }

  selectSide(s: ShotSide): void {
    this.side.set(s);
    this.shotCategory.set(null); // reset category on side change
    this.nextStep();
  }

  selectCategory(c: ShotCategory): void {
    this.shotCategory.set(c);
    this.nextStep();
  }

  selectLocation(l: ShotLocation): void {
    this.location.set(l);
  }

  nextStep(): void {
    if (this.currentStep() < 3) this.currentStep.update(s => s + 1);
  }

  prevStep(): void {
    if (this.currentStep() > 0) this.currentStep.update(s => s - 1);
  }

  submit(): void {
    if (!this.canSubmit()) return;

    const payload: RecordPointInput = {
      winner_id:     this.winnerId(),
      server_id:     this.serverId(),
      shot_type:     this.result()!,
      side:          this.side()!,
      shot_category: this.shotCategory()!,
      location:      this.location()!,
      rally_length:  Number(this.rallyLength()),
      serve_number:  this.side() === 'Serve' ? this.serveNumber() : 1
    };

    this.recorded.emit(payload);
  }

  dismiss(): void {
    this.cancelled.emit();
  }
}
