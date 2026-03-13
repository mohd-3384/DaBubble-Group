import { inject, Injectable } from '@angular/core';
import { Firestore, doc, updateDoc, serverTimestamp, deleteDoc } from '@angular/fire/firestore';
import {
  Auth,
  signOut,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithRedirect,
  EmailAuthProvider,
  GoogleAuthProvider,
} from '@angular/fire/auth';
import { Router } from '@angular/router';

/**
 * Helper service for managing header profile operations
 * Handles profile updates, logout, and user status management
 */
@Injectable({ providedIn: 'root' })
export class HeaderProfileHelper {
  private fs = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);

  /**
   * Updates the user's display name in Firestore
   * @param uid - User ID
   * @param name - New name to save
   * @returns Promise resolving when update is complete
   */
  async updateUserName(uid: string, name: string): Promise<void> {
    try {
      const uref = doc(this.fs, `users/${uid}`);
      await updateDoc(uref, { name });
    } catch (e: any) {
      console.error('[Profile] update failed:', e?.code, e);
      throw e;
    }
  }

  /**
   * Updates the user's avatar URL in Firestore
   * @param uid - User ID
   * @param avatarUrl - New avatar URL to save
   * @returns Promise resolving when update is complete
   */
  async updateUserAvatar(uid: string, avatarUrl: string): Promise<void> {
    try {
      const uref = doc(this.fs, `users/${uid}`);
      await updateDoc(uref, { avatarUrl });
    } catch (e: any) {
      console.error('[Profile] Avatar update failed:', e?.code, e);
      throw e;
    }
  }

  /**
   * Sets the user's online status to offline in Firestore
   * @param uid - User ID to set offline
   * @returns Promise resolving when update is complete
   */
  async setUserOffline(uid: string): Promise<void> {
    try {
      await updateDoc(doc(this.fs, `users/${uid}`), {
        online: false,
        lastSeen: serverTimestamp(),
      });
    } catch (e) {
      console.warn('[Logout] could not set offline:', e);
    }
  }

  /**
   * Logs out the current user
   * Sets user offline, signs out from Firebase, and navigates to login
   * @returns Promise resolving when logout is complete
   */
  async logout(): Promise<void> {
    const u = this.auth.currentUser;
    if (u) {
      await this.setUserOffline(u.uid);
    }

    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  /**
   * Deletes the current user from Firestore and Firebase Authentication.
   * @param uid - User ID to delete
   */
  async deleteUserAccount(uid: string): Promise<void> {
    const u = this.auth.currentUser;
    if (!u) return;

    try {
      await this.setUserOffline(uid);
      await deleteDoc(doc(this.fs, `users/${uid}`));
      await deleteUser(u);
    } finally {
      await signOut(this.auth);
      this.router.navigate(['/login']);
    }
  }

  /**
   * Reauthenticates the current user using email/password.
   */
  async reauthWithPassword(email: string, password: string): Promise<void> {
    const u = this.auth.currentUser;
    if (!u) return;
    const cred = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(u, cred);
  }

  /**
   * Reauthenticates the current user using Google redirect flow.
   */
  async reauthWithGoogleRedirect(): Promise<void> {
    const u = this.auth.currentUser;
    if (!u) return;
    await reauthenticateWithRedirect(u, new GoogleAuthProvider());
  }

  /**
   * Saves the user's display name to Firestore
   * @param newName - The new display name to save
   * @param currentUser - The current authenticated user
   * @returns Promise resolving when save is complete
   */
  async saveDisplayName(newName: string, currentUser: any): Promise<void> {
    const name = (newName || '').trim();
    if (!name) return;

    if (!currentUser) {
      console.warn('[Profile] Not authenticated -> cannot update Firestore');
      return;
    }

    try {
      const ref = doc(this.fs, `users/${currentUser.uid}`);
      await updateDoc(ref, { name });
    } catch (e) {
      console.error('[Profile] update failed:', e);
      throw e;
    }
  }
}
