import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { UserDoc } from '../../../interfaces/allInterfaces.interface';

/**
 * Helper service for shell user data management
 * Handles current user data retrieval from Firestore
 */
@Injectable({ providedIn: 'root' })
export class ShellUserHelper {
  private fs = inject(Firestore);
  private auth = inject(Auth);

  /**
   * Creates an observable stream of current user data
   * @returns Observable of user document with ID or null
   */
  getCurrentUserStream(): Observable<(UserDoc & { id: string }) | null> {
    return authState(this.auth).pipe(
      switchMap(user => this.getUserData(user))
    );
  }

  /**
   * Retrieves user data from Firestore
   * @param user - Authenticated user or null
   * @returns Observable of user document with ID
   */
  private getUserData(user: any): Observable<(UserDoc & { id: string }) | null> {
    if (!user) return of(null);

    const uref = doc(this.fs, `users/${user.uid}`);
    return docData(uref).pipe(
      map((raw: any) => this.mapUserData(raw, user))
    );
  }

  /**
   * Maps raw Firestore data to UserDoc format
   * @param raw - Raw Firestore document data
   * @param user - Authenticated user
   * @returns Formatted user document
   */
  private mapUserData(raw: any, user: any): UserDoc & { id: string } {
    const data = (raw || {}) as any;
    return {
      id: user.uid,
      name: data.name ?? data.displayName ?? user.displayName ?? user.email ?? 'Guest',
      avatarUrl: data.avatarUrl ?? '/public/images/avatars/avatar-default.svg',
      ...data,
    } as UserDoc & { id: string };
  }
}
