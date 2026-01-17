import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, setDoc, updateDoc, serverTimestamp, getDoc } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private auth = inject(Auth);
  private fs = inject(Firestore);

  private sub: Subscription | null = null;
  private unloadHandler: ((ev?: any) => void) | null = null;
  private visHandler: (() => void) | null = null;

  private readonly GUEST_EMAIL = 'guest@dabubble.de';

  init() {
    if (this.sub) return; // init nur 1x

    this.sub = authState(this.auth).subscribe(async (user) => {
      // ✅ Logout -> Handler entfernen, keine Firestore Calls mehr
      if (!user) {
        this.cleanupHandlers();
        return;
      }

      const isGuest = (user.email ?? '').toLowerCase() === this.GUEST_EMAIL;
      const ref = doc(this.fs, `users/${user.uid}`);

      const snap = await getDoc(ref);

      const fallbackName = isGuest ? 'Guest' : (user.displayName ?? user.email ?? 'User');

      const payload: any = {
        ...(snap.exists() ? {} : {
          uid: user.uid,
          name: fallbackName,
          email: user.email ?? '',
          avatarUrl: '/public/images/avatars/avatar-default.svg',
          createdAt: serverTimestamp(),
        }),
        role: isGuest ? 'guest' : 'member',
        status: 'active',
        online: true,
        lastSeen: serverTimestamp(),
      };

      await setDoc(ref, payload, { merge: true });

      this.registerUnloadHandler(user.uid);
      this.registerVisibilityHandler(user.uid);
    });
  }

  private registerUnloadHandler(uid: string) {
    this.unloadHandler = () => {
      // ✅ nur wenn noch eingeloggt
      if (!this.auth.currentUser) return;
      this.setOnline(uid, false);
    };

    window.removeEventListener('beforeunload', this.unloadHandler as any);
    window.addEventListener('beforeunload', this.unloadHandler as any);
  }

  private registerVisibilityHandler(uid: string) {
    this.visHandler = () => {
      if (!this.auth.currentUser) return;
      const hidden = document.visibilityState === 'hidden';
      this.setOnline(uid, !hidden);
    };

    document.removeEventListener('visibilitychange', this.visHandler as any);
    document.addEventListener('visibilitychange', this.visHandler as any);
  }

  private cleanupHandlers() {
    if (this.unloadHandler) {
      window.removeEventListener('beforeunload', this.unloadHandler as any);
      this.unloadHandler = null;
    }
    if (this.visHandler) {
      document.removeEventListener('visibilitychange', this.visHandler as any);
      this.visHandler = null;
    }
  }

  async setOnline(uid: string, online: boolean) {
    // ✅ harte Absicherung
    if (!this.auth.currentUser) return;

    const ref = doc(this.fs, `users/${uid}`);
    try {
      await updateDoc(ref, { online, lastSeen: serverTimestamp() });
    } catch {
      await setDoc(ref, { online, lastSeen: serverTimestamp() }, { merge: true });
    }
  }
}
