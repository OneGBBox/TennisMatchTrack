import { Component, signal, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DatabaseService } from '../../core/services/database.service';
import { OFFLINE_MODE_KEY } from '../../core/guards/auth.guard';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `
    <div class="page">

      <!-- ── Nav bar ──────────────────────────────────────────── -->
      <header class="nav-bar">
        <h1 class="nav-title">Settings</h1>
      </header>

      <div class="page-content settings-content">

        <!-- ── Account section ──────────────────────────────────── -->
        <section class="settings-section">
          <h2 class="section-label">Account</h2>

          @if (isOfflineMode()) {
            <!-- Offline / no-account mode -->
            <div class="settings-row">
              <span class="row-icon">📵</span>
              <div class="row-info">
                <span class="row-title">Offline Mode</span>
                <span class="row-sub">Data stored on this device only</span>
              </div>
            </div>
            <button class="settings-row action-row" (click)="goToSignIn()">
              <span class="row-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
              </span>
              <span class="row-title" style="color: var(--color-primary)">Sign in to sync</span>
            </button>
          } @else {
            <!-- Signed-in mode -->
            <div class="settings-row">
              <div class="row-avatar">{{ avatarLetter() }}</div>
              <div class="row-info">
                <span class="row-title">{{ email() }}</span>
                <span class="row-sub">Signed in</span>
              </div>
            </div>
            <button class="settings-row action-row danger-action" (click)="signOut()">
              <span class="row-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </span>
              <span class="row-title danger-text">Sign Out</span>
            </button>
          }
        </section>

        <!-- ── Appearance section ────────────────────────────────── -->
        <section class="settings-section">
          <h2 class="section-label">Appearance</h2>

          <div class="settings-row">
            <span class="row-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            </span>
            <span class="row-title">Dark Mode</span>
            <button
              class="toggle"
              [class.on]="isDark()"
              (click)="toggleTheme()"
              role="switch"
              [attr.aria-checked]="isDark()"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </section>

        <!-- ── Data section ──────────────────────────────────────── -->
        <section class="settings-section">
          <h2 class="section-label">Data</h2>

          <button class="settings-row action-row" (click)="exportData()" [disabled]="exporting()">
            <span class="row-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </span>
            <span class="row-title">{{ exporting() ? 'Exporting…' : 'Export All Data' }}</span>
            <span class="row-sub-inline">JSON</span>
          </button>

          <label class="settings-row action-row" [class.disabled]="importing()">
            <span class="row-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </span>
            <span class="row-title">{{ importing() ? 'Importing…' : 'Import Data' }}</span>
            <span class="row-sub-inline">JSON</span>
            <input
              type="file"
              accept=".json,application/json"
              class="file-input"
              (change)="onFileSelected($event)"
            />
          </label>

          @if (importResult()) {
            <p class="import-result" [class.error]="importResult()!.startsWith('Error')">
              {{ importResult() }}
            </p>
          }
        </section>

        <!-- ── About section ─────────────────────────────────────── -->
        <section class="settings-section">
          <h2 class="section-label">About</h2>

          <div class="settings-row">
            <span class="row-icon">🎾</span>
            <span class="row-title">TennisMatchTrack</span>
            <span class="row-sub-inline">v1.0.0</span>
          </div>
        </section>

        <div style="height: 32px;"></div>
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
    }
    .nav-title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }

    /* ── Content ──────────────────────────────────────────────── */
    .settings-content { padding: var(--space-4); }

    /* ── Section ─────────────────────────────────────────────── */
    .settings-section {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border-subtle);
      margin-bottom: var(--space-4);
      overflow: hidden;
      animation: tmCardIn 0.42s cubic-bezier(0.34, 1.3, 0.64, 1) both;
    }
    .settings-section:nth-of-type(1) { animation-delay: 0.05s; }
    .settings-section:nth-of-type(2) { animation-delay: 0.12s; }
    .settings-section:nth-of-type(3) { animation-delay: 0.19s; }
    .settings-section:nth-of-type(4) { animation-delay: 0.26s; }
    .section-label {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      padding: var(--space-3) var(--space-4) var(--space-2);
    }

    /* ── Row ──────────────────────────────────────────────────── */
    .settings-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-top: 1px solid var(--color-border-subtle);
      min-height: 52px;
      width: 100%;
      text-align: left;
      cursor: default;
    }
    .action-row { cursor: pointer; transition: transform 0.15s cubic-bezier(0.34,1.4,0.64,1); }
    .action-row:active { background: var(--color-border-subtle); transform: scale(0.97); }
    .action-row:disabled,
    .action-row.disabled { opacity: 0.5; cursor: default; pointer-events: none; }

    .row-icon {
      width: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
      flex-shrink: 0;
    }
    .row-title {
      flex: 1;
      font-size: var(--font-size-base);
      color: var(--color-text-primary);
      font-weight: var(--font-weight-medium);
    }
    .row-sub {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
    }
    .row-sub-inline {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }
    .danger-text { color: #FF3B30; }

    /* ── Account avatar ───────────────────────────────────────── */
    .row-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: var(--color-primary);
      color: #fff;
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-bold);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .row-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* ── Toggle ───────────────────────────────────────────────── */
    .toggle {
      width: 51px; height: 31px;
      border-radius: var(--radius-full);
      background: var(--color-border);
      position: relative;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .toggle.on { background: #34C759; }
    .toggle-thumb {
      position: absolute;
      top: 2px; left: 2px;
      width: 27px; height: 27px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.25);
      transition: transform 0.2s;
    }
    .toggle.on .toggle-thumb { transform: translateX(20px); }

    /* ── File input ───────────────────────────────────────────── */
    .file-input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }

    /* ── Import result ────────────────────────────────────────── */
    .import-result {
      font-size: var(--font-size-sm);
      color: #34C759;
      padding: var(--space-2) var(--space-4) var(--space-3);
    }
    .import-result.error { color: #FF3B30; }
  `]
})
export class SettingsComponent implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly db     = inject(DatabaseService);
  private readonly router = inject(Router);

  isDark       = signal(false);
  exporting    = signal(false);
  importing    = signal(false);
  importResult = signal<string | null>(null);
  isOfflineMode = signal(false);

  email        = () => this.auth.email ?? 'Unknown';
  avatarLetter = () => (this.auth.email?.[0] ?? '?').toUpperCase();

  ngOnInit(): void {
    this.isDark.set(document.documentElement.getAttribute('data-theme') === 'dark');
    this.isOfflineMode.set(localStorage.getItem(OFFLINE_MODE_KEY) === 'true');
  }

  // ── Theme ─────────────────────────────────────────────────────────────────

  toggleTheme(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '');
    localStorage.setItem('tennis-theme', next ? 'dark' : 'light');
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async signOut(): Promise<void> {
    localStorage.removeItem(OFFLINE_MODE_KEY);
    await this.auth.signOut();
    this.router.navigate(['/auth/login']);
  }

  goToSignIn(): void {
    localStorage.removeItem(OFFLINE_MODE_KEY);
    this.router.navigate(['/auth/login']);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async exportData(): Promise<void> {
    this.exporting.set(true);
    try {
      const db      = await this.db.getDb();
      const players = (await db.players.find().exec()).map(d => d.toJSON());
      const matches = (await db.matches.find().exec()).map(d => d.toJSON());

      const payload = JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), players, matches },
        null, 2
      );

      const blob = new Blob([payload], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `tennismatch-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Settings] Export failed:', err);
    } finally {
      this.exporting.set(false);
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.importing.set(true);
    this.importResult.set(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!Array.isArray(json.players) || !Array.isArray(json.matches)) {
        throw new Error('Invalid backup file — expected { players[], matches[] }');
      }

      const db = await this.db.getDb();

      if (json.players.length > 0) {
        await db.players.bulkUpsert(json.players);
      }
      if (json.matches.length > 0) {
        await db.matches.bulkUpsert(json.matches);
      }

      this.importResult.set(
        `✓ Imported ${json.players.length} player(s) and ${json.matches.length} match(es).`
      );
    } catch (err: any) {
      this.importResult.set(`Error: ${err?.message ?? 'Import failed'}`);
    } finally {
      this.importing.set(false);
      // Reset the file input so the same file can be re-selected
      (event.target as HTMLInputElement).value = '';
    }
  }
}
