import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly _supabase: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        // Bypass Navigator Locks API to avoid lock-acquisition timeouts
        lock: <R>(_: string, __: number, fn: () => Promise<R>) => fn()
      }
    }
  );

  private readonly _user    = signal<User | null>(null);
  private readonly _loading = signal(true);

  // ── Public signals ────────────────────────────────────────────────────────
  readonly currentUser     = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isLoading       = this._loading.asReadonly();

  // Promise that resolves once the initial session check is complete.
  // The auth guard awaits this before checking isAuthenticated().
  private readonly _initPromise: Promise<void>;

  constructor() {
    this._initPromise = this._supabase.auth.getSession().then(({ data }) => {
      this._user.set(data.session?.user ?? null);
      this._loading.set(false);
    });

    // Keep signals in sync with every auth state change (login, logout, refresh)
    this._supabase.auth.onAuthStateChange((_, session) => {
      this._user.set(session?.user ?? null);
      this._loading.set(false);
    });
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  /** Underlying Supabase client — shared with ReplicationService. */
  get client(): SupabaseClient { return this._supabase; }
  get uid():   string | null   { return this._user()?.id    ?? null; }
  get email(): string | null   { return this._user()?.email ?? null; }

  /** Resolves once the initial getSession() call finishes. */
  waitForInit(): Promise<void> { return this._initPromise; }

  // ── Auth operations ───────────────────────────────────────────────────────

  signInWithPassword(email: string, password: string) {
    return this._supabase.auth.signInWithPassword({ email, password });
  }

  signInWithOtp(email: string) {
    return this._supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false }
    });
  }

  signUp(email: string, password: string) {
    return this._supabase.auth.signUp({ email, password });
  }

  signOut() {
    return this._supabase.auth.signOut();
  }
}
