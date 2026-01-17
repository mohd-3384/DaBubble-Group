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
import { Observable } from 'rxjs';
import { UserDoc } from '../interfaces/allInterfaces.interface';

@Injectable({ providedIn: 'root' })
export class UserService {
  private fs = inject(Firestore);
  private auth = inject(Auth);

  // Optional: Liste aller User (für Direktnachrichten)
  users$(): Observable<UserDoc[]> {
    const ref = collection(this.fs, 'users');
    return collectionData(ref, { idField: 'id' }) as Observable<UserDoc[]>;
  }

  /**
   * ✅ Users-Dokument wird nur unter users/{uid} geführt.
   * - existiert es schon: update online/lastSeen (und optional merge data)
   * - existiert es nicht: wird genau 1x angelegt
   */
  async ensureUserDoc(extra?: Partial<UserDoc> & { name?: string }) {
    const u = this.auth.currentUser;
    if (!u) throw new Error('[UserService] ensureUserDoc: not authenticated');

    const ref = doc(this.fs, `users/${u.uid}`);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      // schon da -> nur Presence / lastSeen aktualisieren
      await updateDoc(ref, {
        online: true,
        lastSeen: serverTimestamp(),
        ...(extra ? { ...extra } : {}),
      } as any);
      return;
    }

    // neu anlegen (einmalig)
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

  async setOnline(online: boolean) {
    const u = this.auth.currentUser;
    if (!u) return;

    await updateDoc(doc(this.fs, `users/${u.uid}`), {
      online,
      lastSeen: serverTimestamp(),
    });
  }
}
