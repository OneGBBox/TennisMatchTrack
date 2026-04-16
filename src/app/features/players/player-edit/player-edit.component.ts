import {
  Component, OnInit, signal, computed, inject
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';

import { DatabaseService } from '../../../core/services/database.service';
import { Player, HittingArm, BackhandType } from '../../../core/models/player.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

const NTRP_VALUES = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0];

@Component({
  selector: 'app-player-edit',
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
        <h1 class="nav-title">{{ isNew() ? 'New Player' : 'Edit Player' }}</h1>
        <button
          class="nav-save"
          [disabled]="!canSave"
          (click)="save()"
        >{{ saving() ? 'Saving…' : 'Save' }}</button>
      </header>

      <!-- ── Form ─────────────────────────────────────────────── -->
      <div class="page-content form-content">

        <!-- Avatar preview -->
        <div class="avatar-section">
          <div class="avatar-wrapper">
            <app-avatar [name]="name || 'P'" [imageUrl]="imageUrl || undefined" [size]="88" />
            @if (imageUrl) {
              <button class="avatar-clear" (click)="imageUrl = ''" aria-label="Remove photo">✕</button>
            }
          </div>
          <p class="avatar-hint">
            {{ imageUrl ? 'Photo from URL' : 'Auto-generated from name' }}
          </p>
        </div>

        <!-- Basic info section -->
        <section class="form-section">
          <h2 class="section-label">Basic Info</h2>

          <label class="field-label">
            Name *
            <input
              class="field-input"
              type="text"
              [(ngModel)]="name"
              placeholder="Full name"
              autocomplete="name"
            />
          </label>

          <label class="field-label">
            Photo URL
            <input
              class="field-input"
              type="url"
              [(ngModel)]="imageUrl"
              placeholder="https://example.com/photo.jpg"
              autocomplete="off"
            />
            <span class="field-hint">Paste any public image URL — shown as your avatar</span>
          </label>
        </section>

        <!-- Ratings section -->
        <section class="form-section">
          <h2 class="section-label">Ratings</h2>

          <label class="field-label">
            NTRP Rating
            <select class="field-input" [(ngModel)]="ntrpRating">
              <option [ngValue]="null">Not rated</option>
              @for (v of NTRP_VALUES; track v) {
                <option [ngValue]="v">{{ v.toFixed(1) }}</option>
              }
            </select>
          </label>

          <label class="field-label">
            UTR Rating
            <div class="slider-row">
              <input
                class="rating-slider"
                type="range"
                min="0" max="16.5" step="0.1"
                [ngModel]="utrRating ?? 0"
                (ngModelChange)="utrRating = $event > 0 ? $event : null"
              />
              <span class="slider-value">
                {{ utrRating != null ? utrRating.toFixed(1) : '—' }}
              </span>
            </div>
            <div class="slider-labels">
              <span>0</span><span>5</span><span>10</span><span>16.5</span>
            </div>
          </label>
        </section>

        <!-- Playing style section -->
        <section class="form-section">
          <h2 class="section-label">Playing Style</h2>

          <div class="choice-row">
            <span class="choice-row-label">Dominant Arm</span>
            <div class="seg-control">
              <button [class.active]="hittingArm === 'Right'" (click)="hittingArm = 'Right'">Right</button>
              <button [class.active]="hittingArm === 'Left'"  (click)="hittingArm = 'Left'">Left</button>
            </div>
          </div>

          <div class="choice-row">
            <span class="choice-row-label">Backhand</span>
            <div class="seg-control">
              <button [class.active]="backhandType === 'One-hand'"  (click)="backhandType = 'One-hand'">1H</button>
              <button [class.active]="backhandType === 'Two-hand'"  (click)="backhandType = 'Two-hand'">2H</button>
            </div>
          </div>
        </section>

        <!-- Delete section (edit only) -->
        @if (!isNew()) {
          <section class="form-section danger-section">
            <button class="delete-btn" (click)="deletePlayer()">
              Delete Player
            </button>
          </section>
        }

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
    .nav-save {
      color: var(--color-primary);
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-bold);
      min-width: 44px;
      text-align: right;
    }
    .nav-save:disabled { opacity: 0.35; cursor: default; }

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

    /* ── Avatar section ───────────────────────────────────────── */
    .avatar-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-6) 0 var(--space-4);
    }
    .avatar-wrapper {
      position: relative;
      display: inline-flex;
    }
    .avatar-clear {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #FF3B30;
      color: #fff;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .avatar-hint {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }
    .field-hint {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      margin-top: -var(--space-1);
    }

    /* ── Fields ───────────────────────────────────────────────── */
    .field-label {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
      font-weight: var(--font-weight-medium);
      margin-bottom: var(--space-4);
    }
    .field-label:last-child { margin-bottom: 0; }
    .field-input {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      font-size: var(--font-size-base);
      font-family: var(--font-family);
      color: var(--color-text-primary);
      background: var(--color-bg);
      outline: none;
      transition: border-color 0.15s;
      width: 100%;
    }
    .field-input:focus { border-color: var(--color-primary); }

    /* ── Slider ───────────────────────────────────────────────── */
    .slider-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .rating-slider {
      flex: 1;
      accent-color: var(--color-primary);
    }
    .slider-value {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      color: var(--color-primary);
      min-width: 36px;
      text-align: right;
    }
    .slider-labels {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    /* ── Choice rows ──────────────────────────────────────────── */
    .choice-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) 0;
      border-bottom: 1px solid var(--color-border-subtle);
    }
    .choice-row:last-child { border-bottom: none; }
    .choice-row-label {
      font-size: var(--font-size-base);
      color: var(--color-text-primary);
      font-weight: var(--font-weight-medium);
    }

    /* ── Segmented control ────────────────────────────────────── */
    .seg-control {
      display: flex;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 2px;
      gap: 2px;
    }
    .seg-control button {
      padding: var(--space-2) var(--space-4);
      border-radius: calc(var(--radius-md) - 2px);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-muted);
      transition: background 0.15s, color 0.15s;
    }
    .seg-control button.active {
      background: var(--color-primary);
      color: #fff;
    }

    /* ── Danger section ───────────────────────────────────────── */
    .danger-section {
      border-color: rgba(255,59,48,0.25);
      text-align: center;
    }
    .delete-btn {
      color: #FF3B30;
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
      padding: var(--space-3);
      width: 100%;
    }
  `]
})
export class PlayerEditComponent implements OnInit {
  private db    = inject(DatabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // ── State ─────────────────────────────────────────────────────────────────
  isNew      = signal(true);
  playerId   = signal('');
  saving     = signal(false);

  name          = '';
  imageUrl      = '';
  ntrpRating:   number | null = null;
  utrRating:    number | null = null;
  hittingArm:   HittingArm | null = null;
  backhandType: BackhandType | null = null;

  readonly NTRP_VALUES = NTRP_VALUES;

  /** Getter so Angular template re-evaluates on every change detection cycle.
   *  Using computed() would fail here because `name` is a plain string, not a signal. */
  get canSave(): boolean { return this.name.trim().length > 0 && !this.saving(); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    const isNew = !id || id === 'new';
    this.isNew.set(isNew);

    if (!isNew && id) {
      this.playerId.set(id);
      const db  = await this.db.getDb();
      const doc = await db.players.findOne(id).exec();
      if (doc) {
        const p           = doc.toJSON() as Player;
        this.name         = p.name;
        this.imageUrl     = p.image_url     ?? '';
        this.ntrpRating   = p.ntrp_rating   ?? null;
        this.utrRating    = p.utr_rating    ?? null;
        this.hittingArm   = p.hitting_arm   ?? null;
        this.backhandType = p.backhand_type ?? null;
      }
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave) return;

    this.saving.set(true);

    const data: any = {
      name:          this.name.trim(),
      image_url:     this.imageUrl.trim() || undefined,
      ntrp_rating:   this.ntrpRating  ?? undefined,
      utr_rating:    this.utrRating   ?? undefined,
      hitting_arm:   this.hittingArm  ?? undefined,
      backhand_type: this.backhandType ?? undefined
    };

    if (!this.isNew()) {
      data['id'] = this.playerId();
    }

    try {
      await this.db.upsertPlayer(data);
    } catch (err) {
      console.error('[PlayerEdit] upsertPlayer FAILED:', err);
      this.saving.set(false);
      alert('Save failed. Please try again.');
      return;
    }

    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    if (returnTo) {
      this.router.navigateByUrl(returnTo);
    } else {
      this.router.navigate(['/players']);
    }
  }

  async deletePlayer(): Promise<void> {
    if (this.isNew()) return;
    const confirmed = confirm(`Delete ${this.name}? This cannot be undone.`);
    if (!confirmed) return;

    await this.db.softDeletePlayer(this.playerId());
    this.router.navigate(['/players']);
  }

  cancel(): void {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    if (returnTo) {
      this.router.navigateByUrl(returnTo);
    } else {
      this.router.navigate(['/players']);
    }
  }
}
