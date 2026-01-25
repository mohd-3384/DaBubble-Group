import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  serverTimestamp,
  runTransaction,
  increment,
  collection,
  addDoc,
  collectionData,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { ChannelDoc } from '../interfaces/allInterfaces.interface';
import { AuthReadyService } from './auth-ready.service';

@Injectable({ providedIn: 'root' })
export class ChannelService {
  private fs = inject(Firestore);
  private authReady = inject(AuthReadyService);

  /** Channel anlegen – mit auto-generierter ID und name Feld */
  async createChannel(name: string, topic: string = ''): Promise<string> {
    const user = await this.authReady.requireUser();

    // Auto-ID von Firestore generieren
    const channelsRef = collection(this.fs, 'channels');
    const docRef = doc(channelsRef);
    const channelId = docRef.id;

    await setDoc(docRef, {
      name, // Speichere den Display-Namen
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      memberCount: 0,
      messageCount: 0,
      lastMessageAt: null,
      lastMessageBy: null,
      lastReplyAt: null,
      topic,
    });

    return channelId; // Gebe die generierte ID zurück
  }

  /**
   * Aktuellen User als Member hinzufügen
   * + memberCount nur hochzählen, wenn der Member-Datensatz vorher NICHT existierte
   */
  async addMeAsMember(channelId: string, role: 'owner' | 'member' = 'member'): Promise<void> {
    const user = await this.authReady.requireUser();

    const uid = user.uid;
    const chRef = doc(this.fs, `channels/${channelId}`);
    const memRef = doc(this.fs, `channels/${channelId}/members/${uid}`);

    await runTransaction(this.fs, async (tx) => {
      const memSnap = await tx.get(memRef);

      if (!memSnap.exists()) {
        tx.set(memRef, { role, joinedAt: serverTimestamp() });
        tx.update(chRef, { memberCount: increment(1) });
      } else {
        tx.set(memRef, { role }, { merge: true });
      }
    });
  }

  /** Welcome-Message (Bot) – authorId bleibt echter User (dein aktuelles Modell) */
  async postWelcome(channelId: string): Promise<void> {
    const user = await this.authReady.requireUser();

    await addDoc(collection(this.fs, `channels/${channelId}/messages`), {
      text: `Willkommen in #${channelId}!`,
      authorId: user.uid,
      authorName: 'Devspace Bot',
      authorAvatar: '/public/images/avatars/avatar-default.svg',
      createdAt: serverTimestamp(),
      editedAt: null,
      replyCount: 0,
      lastReplyAt: null,
      reactions: {},
    });
  }

  async leaveChannel(channelId: string): Promise<void> {
    const user = await this.authReady.requireUser();

    const uid = user.uid;
    const chRef = doc(this.fs, `channels/${channelId}`);
    const memRef = doc(this.fs, `channels/${channelId}/members/${uid}`);

    await runTransaction(this.fs, async (tx) => {
      const memSnap = await tx.get(memRef);

      if (memSnap.exists()) {
        tx.delete(memRef);
        tx.update(chRef, { memberCount: increment(-1) });
      }
    });
  }

  channels$(): Observable<ChannelDoc[]> {
    const ref = collection(this.fs, 'channels');
    return (collectionData(ref, { idField: 'id' }) as Observable<ChannelDoc[]>).pipe(
      map((list) =>
        [...list].sort((a: any, b: any) =>
          String(a.name ?? '').localeCompare(String(b.name ?? ''), 'de', { sensitivity: 'base' })
        )
      )
    );
  }
}
