import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const OFFLINE_MODE_KEY = 'tennis-offline-mode';

/**
 * Protects routes that require a signed-in user.
 *
 * Passes through when:
 *  • The user is authenticated via Supabase, OR
 *  • The user chose "Continue without account" (offline-mode flag in localStorage)
 *
 * Otherwise redirects to /auth/login.
 */
export const authGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Offline / local-only bypass
  if (localStorage.getItem(OFFLINE_MODE_KEY) === 'true') return true;

  // Wait for initial Supabase session check before deciding
  await auth.waitForInit();

  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login']);
};
