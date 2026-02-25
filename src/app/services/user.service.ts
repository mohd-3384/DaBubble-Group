import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
  collection,
  collectionData,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, firstValueFrom } from 'rxjs';
import { UserDoc } from '../interfaces/allInterfaces.interface';

/**
 * Service for managing user documents in Firestore
 * Handles user creation, presence updates, and user listing
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private fs = inject(Firestore);
  private auth = inject(Auth);

  /**
   * Returns an observable stream of all users from Firestore
   * @returns Observable of user documents array
   */
  users$(): Observable<UserDoc[]> {
    const ref = collection(this.fs, 'users');
    return collectionData(ref, { idField: 'id' }) as Observable<UserDoc[]>;
  }

  /**
   * Ensures a user document exists in Firestore under users/{uid}
   * If document exists: updates online/lastSeen and merges extra data
   * If document doesn't exist: creates it with default values
   * @param extra - Optional partial user data to merge with defaults
   */
  async ensureUserDoc(extra?: Partial<UserDoc> & { name?: string }) {
    const u = this.auth.currentUser;
    if (!u) throw new Error('[UserService] ensureUserDoc: not authenticated');

    const ref = doc(this.fs, `users/${u.uid}`);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      await this.updateExistingUser(ref, extra);
    } else {
      await this.createNewUser(ref, u, extra);
    }
  }

  /**
   * Updates an existing user document with online status and extra data
   * @param ref - Firestore document reference
   * @param extra - Optional extra user data to merge
   */
  private async updateExistingUser(ref: any, extra?: Partial<UserDoc>) {
    await updateDoc(ref, {
      online: true,
      lastSeen: serverTimestamp(),
      ...(extra ? { ...extra } : {}),
    } as any);
  }

  /**
   * Creates a new user document with default values
   * @param ref - Firestore document reference
   * @param u - Firebase user object
   * @param extra - Optional extra user data to merge
   */
  private async createNewUser(ref: any, u: any, extra?: Partial<UserDoc> & { name?: string }) {
    await setDoc(
      ref,
      {
        uid: u.uid,
        name: (extra?.name ?? u.displayName ?? 'User').trim(),
        email: u.email ?? '',
        avatarUrl: '/public/images/avatars/avatar-default.svg',
        role: (extra as any)?.role ?? 'member',
        status: (extra as any)?.status ?? 'active',
        online: true,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        ...(extra ?? {}),
      } as any,
      { merge: true }
    );
  }

  /**
   * Updates the online status of the current user
   * @param online - True to set user as online, false for offline
   */
  async setOnline(online: boolean) {
    const u = this.auth.currentUser;
    if (!u) return;

    await updateDoc(doc(this.fs, `users/${u.uid}`), {
      online,
      lastSeen: serverTimestamp(),
    });
  }

  /**
   * Checks if a user name already exists (case-insensitive)
   * @param name - Name to check
   * @param excludeId - Optional user ID to exclude
   * @returns True if a duplicate exists
   */
  async isUserNameTaken(name: string, excludeId?: string): Promise<boolean> {
    const normalized = this.normalizeName(name);
    if (!normalized) return false;
    try {
      const ref = collection(this.fs, 'users');
      const list = await firstValueFrom(
        collectionData(ref, { idField: 'id' }) as Observable<UserDoc[]>
      );
      return list.some(
        (u) =>
          this.normalizeName(String(u.name ?? '')) === normalized &&
          (!excludeId || u.id !== excludeId)
      );
    } catch {
      return false;
    }
  }

  /**
   * Normalizes user names for comparison
   * @param name - User name
   * @returns Normalized name
   */
  private normalizeName(name: string): string {
    return String(name || '').trim().toLowerCase();
  }
}
