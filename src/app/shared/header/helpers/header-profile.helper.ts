import { inject, Injectable } from '@angular/core';
import { Firestore, doc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { Auth, signOut } from '@angular/fire/auth';
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
        console.log('[Profile] uid:', uid);

        try {
            const uref = doc(this.fs, `users/${uid}`);
            await updateDoc(uref, { name });
            console.log('[Profile] update ok');
        } catch (e: any) {
            console.error('[Profile] update failed:', e?.code, e);
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
