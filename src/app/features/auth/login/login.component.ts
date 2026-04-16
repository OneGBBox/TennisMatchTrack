import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

type Mode = 'signin' | 'signup' | 'magic';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-page">

      <!-- ── Branding ─────────────────────────────────────────── -->
      <div class="brand">
        <div class="brand-icon">🎾</div>
        <h1 class="brand-title">TennisMatchTrack</h1>
        <p class="brand-sub">Track every point, anywhere</p>
      </div>

      <!-- ── Mode tabs ────────────────────────────────────────── -->
      <div class="mode-tabs">
        <button [class.active]="mode() === 'signin'" (click)="setMode('signin')">Sign In</button>
        <button [class.active]="mode() === 'signup'" (click)="setMode('signup')">Sign Up</button>
      </div>

      <!-- ── Form card ─────────────────────────────────────────── -->
      <div class="form-card">

        <!-- Magic link sent confirmation -->
        @if (magicSent()) {
          <div class="magic-sent">
            <div class="magic-icon">✉️</div>
            <h2>Check your email</h2>
            <p>We sent a sign-in link to <strong>{{ email }}</strong>.<br>Click it to log in instantly.</p>
            <button class="btn-ghost" (click)="magicSent.set(false)">Use a different email</button>
          </div>
        } @else {

          <!-- Email -->
          <label class="field-label">
            Email
            <input
              class="field-input"
              type="email"
              [(ngModel)]="email"
              placeholder="you@example.com"
              autocomplete="email"
              [disabled]="loading()"
            />
          </label>

          <!-- Password (not shown for magic link) -->
          @if (mode() !== 'magic') {
            <label class="field-label">
              Password
              <input
                class="field-input"
                [type]="showPassword() ? 'text' : 'password'"
                [(ngModel)]="password"
                [placeholder]="mode() === 'signup' ? 'Create a password' : 'Your password'"
                autocomplete="{{ mode() === 'signup' ? 'new-password' : 'current-password' }}"
                [disabled]="loading()"
              />
              <button
                type="button"
                class="pw-toggle"
                (click)="showPassword.set(!showPassword())"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
              >{{ showPassword() ? 'Hide' : 'Show' }}</button>
            </label>
          }

          <!-- Error -->
          @if (error()) {
            <p class="error-msg">{{ error() }}</p>
          }

          <!-- Primary action -->
          <button
            class="btn-primary submit-btn"
            [disabled]="loading() || !canSubmit"
            (click)="submit()"
          >
            @if (loading()) {
              <span class="spinner"></span>
            } @else {
              {{ submitLabel }}
            }
          </button>

          <!-- Magic-link toggle -->
          @if (mode() === 'signin') {
            <button class="btn-ghost magic-toggle" (click)="setMode('magic')">
              Sign in with magic link instead
            </button>
          } @else if (mode() === 'magic') {
            <button class="btn-ghost magic-toggle" (click)="setMode('signin')">
              Use password instead
            </button>
          }
        }
      </div>

      <!-- ── Offline bypass ───────────────────────────────────── -->
      @if (!magicSent()) {
        <div class="offline-section">
          <div class="divider"><span>or</span></div>
          <button class="offline-btn" (click)="continueOffline()">
            Continue without account
          </button>
          <p class="offline-note">Data stays on this device only. You can sign in later.</p>
        </div>
      }

      <!-- ── Footer note ───────────────────────────────────────── -->
      @if (!magicSent()) {
        <p class="footer-note">
          @if (mode() === 'signup') {
            Already have an account?
            <button class="link-btn" (click)="setMode('signin')">Sign in</button>
          } @else {
            No account yet?
            <button class="link-btn" (click)="setMode('signup')">Create one</button>
          }
        </p>
      }

    </div>
  `,
  styles: [`
    /* ── Layout ───────────────────────────────────────────────── */
    .auth-page {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-6) var(--space-5);
      gap: var(--space-6);
      background: var(--color-bg);
    }

    /* ── Branding ─────────────────────────────────────────────── */
    .brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      text-align: center;
    }
    .brand-icon { font-size: 56px; line-height: 1; margin-bottom: var(--space-1); }
    .brand-title {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }
    .brand-sub {
      font-size: var(--font-size-base);
      color: var(--color-text-muted);
    }

    /* ── Mode tabs ────────────────────────────────────────────── */
    .mode-tabs {
      display: flex;
      background: var(--color-border-subtle);
      border-radius: var(--radius-full);
      padding: 3px;
      gap: 2px;
      width: 100%;
      max-width: 360px;
    }
    .mode-tabs button {
      flex: 1;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-full);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-muted);
      transition: background 0.15s, color 0.15s;
    }
    .mode-tabs button.active {
      background: var(--color-surface);
      color: var(--color-text-primary);
      box-shadow: var(--shadow-sm);
    }

    /* ── Form card ────────────────────────────────────────────── */
    .form-card {
      width: 100%;
      max-width: 360px;
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border-subtle);
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      box-shadow: var(--shadow-md);
    }

    /* ── Fields ───────────────────────────────────────────────── */
    .field-label {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-muted);
      position: relative;
    }
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
    .field-input:disabled { opacity: 0.5; }

    /* ── Password show/hide ───────────────────────────────────── */
    .pw-toggle {
      position: absolute;
      right: var(--space-3);
      bottom: var(--space-3);
      font-size: var(--font-size-xs);
      color: var(--color-primary);
      font-weight: var(--font-weight-medium);
      padding: 2px 4px;
    }

    /* ── Error ────────────────────────────────────────────────── */
    .error-msg {
      font-size: var(--font-size-sm);
      color: #FF3B30;
      background: rgba(255,59,48,0.08);
      border-radius: var(--radius-sm);
      padding: var(--space-2) var(--space-3);
    }

    /* ── Submit ───────────────────────────────────────────────── */
    .submit-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      min-height: 48px;
    }
    .submit-btn:disabled { opacity: 0.5; cursor: default; }

    /* ── Spinner ──────────────────────────────────────────────── */
    .spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Ghost button ─────────────────────────────────────────── */
    .btn-ghost {
      color: var(--color-primary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      text-align: center;
      padding: var(--space-2);
    }
    .magic-toggle { width: 100%; }

    /* ── Footer ───────────────────────────────────────────────── */
    .footer-note {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
      text-align: center;
    }
    .link-btn {
      color: var(--color-primary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      padding: 0 2px;
    }

    /* ── Magic sent ───────────────────────────────────────────── */
    .magic-sent {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-3);
      padding: var(--space-4) 0;
    }
    .magic-icon { font-size: 40px; line-height: 1; }
    .magic-sent h2 {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
    }
    .magic-sent p {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
      line-height: var(--line-height-normal);
    }

    /* ── Offline bypass ───────────────────────────────────────── */
    .offline-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      max-width: 360px;
    }
    .divider {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--color-border);
    }
    .offline-btn {
      width: 100%;
      max-width: 360px;
      height: 44px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      transition: background 0.15s, border-color 0.15s;
    }
    .offline-btn:active {
      background: var(--color-border-subtle);
    }
    .offline-note {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      text-align: center;
    }
  `]
})
export class LoginComponent {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  mode         = signal<Mode>('signin');
  loading      = signal(false);
  error        = signal('');
  magicSent    = signal(false);
  showPassword = signal(false);

  email    = '';
  password = '';

  setMode(m: Mode): void {
    this.mode.set(m);
    this.error.set('');
    this.password = '';
  }

  get canSubmit(): boolean {
    const e = this.email.trim();
    if (!e || !e.includes('@')) return false;
    if (this.mode() === 'magic') return true;
    return this.password.length >= 6;
  }

  get submitLabel(): string {
    switch (this.mode()) {
      case 'signin': return 'Sign In';
      case 'signup': return 'Create Account';
      case 'magic':  return 'Send Magic Link';
    }
  }

  async submit(): Promise<void> {
    if (!this.canSubmit || this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    try {
      if (this.mode() === 'magic') {
        const { error } = await this.auth.signInWithOtp(this.email.trim());
        if (error) throw error;
        this.magicSent.set(true);
        return;
      }

      if (this.mode() === 'signup') {
        const { error } = await this.auth.signUp(this.email.trim(), this.password);
        if (error) throw error;
        // After sign-up Supabase may require email confirmation;
        // signInWithPassword will succeed once confirmed.
        const { error: signInErr } = await this.auth.signInWithPassword(
          this.email.trim(), this.password
        );
        if (signInErr) {
          this.error.set('Account created! Check your email to confirm, then sign in.');
          return;
        }
      } else {
        const { error } = await this.auth.signInWithPassword(
          this.email.trim(), this.password
        );
        if (error) throw error;
      }

      this.router.navigate(['/matches']);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  continueOffline(): void {
    localStorage.setItem('tennis-offline-mode', 'true');
    this.router.navigate(['/matches']);
  }
}
