import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map, take } from 'rxjs/operators';

/**
 * Route guard that checks if a user is authenticated
 * Redirects to login page if user is not authenticated
 * @returns Observable that emits true if user is authenticated, false otherwise
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    map(user => {
      if (user) return true;
      router.navigateByUrl('/login');
      return false;
    })
  );
};
