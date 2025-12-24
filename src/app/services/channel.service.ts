import { Injectable, inject } from '@angular/core';
import {
  Firestore, doc, setDoc, serverTimestamp, runTransaction,
  increment, collection, addDoc, collectionData
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, map } from 'rxjs';
import { ChannelDoc } from '../interfaces/channel.interface';

@Injectable({ providedIn: 'root' })
export class ChannelService {
  private fs = inject(Firestore);
  private auth = inject(Auth);

  /** Channel anlegen – Creator ist IMMER der eingeloggte User */
  async createChannel(id: string) {
    const authUser = this.auth.currentUser;
    if (!authUser) throw new Error('[ChannelService] createChannel: not authenticated');

    await setDoc(doc(this.fs, `channels/${id}`), {
      createdBy: authUser.uid,
      createdAt: serverTimestamp(),
      memberCount: 0,
      messageCount: 0,
      lastMessageAt: null,
      lastMessageBy: null,
      lastReplyAt: null,
      topic: ''
    });
  }

  /** Aktuellen User als Member hinzufügen + memberCount hochzählen */
  async addMeAsMember(channelId: string, role: 'owner' | 'member' = 'member') {
    const authUser = this.auth.currentUser;
    if (!authUser) throw new Error('[ChannelService] addMeAsMember: not authenticated');

    const uid = authUser.uid;
    const chRef = doc(this.fs, `channels/${channelId}`);
    const memRef = doc(this.fs, `channels/${channelId}/members/${uid}`);

    await runTransaction(this.fs, tx => {
      tx.set(memRef, { role, joinedAt: serverTimestamp() });
      tx.update(chRef, { memberCount: increment(1) });
      return Promise.resolve();
    });
  }

  /** Welcome-Message – authorId = eingeloggter User */
  async postWelcome(channelId: string) {
    const authUser = this.auth.currentUser;
    if (!authUser) {
      console.warn('[ChannelService] postWelcome: no auth user -> skip');
      return;
    }

    await addDoc(collection(this.fs, `channels/${channelId}/messages`), {
      text: `Willkommen in #${channelId}!`,
      authorId: authUser.uid,
      authorName: 'Devspace Bot',
      authorAvatar: '/public/images/avatars/avatar-default.svg',
      createdAt: serverTimestamp(),
      editedAt: null,
      replyCount: 0,
      lastReplyAt: null,
      reactions: {}
    });
  }

  channels$(): Observable<ChannelDoc[]> {
    const ref = collection(this.fs, 'channels');
    return (collectionData(ref, { idField: 'id' }) as Observable<ChannelDoc[]>).pipe(
      map(list =>
        [...list].sort((a: any, b: any) =>
          String(a.id).localeCompare(String(b.id), 'de', { sensitivity: 'base' })
        )
      )
    );
  }
}
