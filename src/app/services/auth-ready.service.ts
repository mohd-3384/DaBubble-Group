import { inject, Injectable } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';

/**
 * Service for ensuring user authentication is ready before performing operations
 */
@Injectable({ providedIn: 'root' })
export class AuthReadyService {
  private auth = inject(Auth);

  /**
   * Waits for and returns the first authenticated user from the auth state stream
   * @returns Promise resolving to the authenticated user
   * @throws Error if user is not authenticated
   */
  async requireUser() {
    return await firstValueFrom(
      authState(this.auth).pipe(filter((u): u is NonNullable<typeof u> => !!u))
    );
  }
}
