import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects routes that require a signed-in user.
 * Waits for the initial Supabase session check before deciding,
 * so authenticated users are never bounced to login on hard refresh.
 */
export const authGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Resolve first-load session before checking auth state
  await auth.waitForInit();

  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login']);
};
