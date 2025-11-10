import { Injectable, inject } from '@angular/core';
import {
  Firestore, doc, setDoc, serverTimestamp, runTransaction,
  increment, collection, addDoc, collectionData
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { ChannelDoc } from '../interfaces/channel.interface';

@Injectable({ providedIn: 'root' })
export class ChannelService {
  private fs = inject(Firestore);

  async createChannel(id: string, createdBy: string) {
    await setDoc(doc(this.fs, `channels/${id}`), {
      createdBy,
      createdAt: serverTimestamp(),
      memberCount: 0,
      messageCount: 0,
      lastMessageAt: null,
      lastMessageBy: null,
      lastReplyAt: null,
      topic: ''
    });
  }

  async addMember(channelId: string, uid: string, role: 'owner' | 'member' = 'member') {
    const chRef = doc(this.fs, `channels/${channelId}`);
    const memRef = doc(this.fs, `channels/${channelId}/members/${uid}`);
    await runTransaction(this.fs, tx => {
      tx.set(memRef, { role, joinedAt: serverTimestamp() });
      tx.update(chRef, { memberCount: increment(1) });
      return Promise.resolve();
    });
  }

  async postWelcome(channelId: string, author: { id: string; name: string; avatar: string }) {
    await addDoc(collection(this.fs, `channels/${channelId}/messages`), {
      text: `Willkommen in #${channelId}!`,
      authorId: author.id,
      authorName: author.name,
      authorAvatar: author.avatar,
      createdAt: serverTimestamp(),
      editedAt: null,
      replyCount: 0,
      lastReplyAt: null,
      reactions: {}
    });
  }

  /**
   * Alle Channels – wir lesen die Sammlung und benutzen die Dokument-ID als 'id'.
   */
  channels$(): Observable<ChannelDoc[]> {
    const ref = collection(this.fs, 'channels');

    return (collectionData(ref, { idField: 'id' }) as Observable<ChannelDoc[]>).pipe(
      map(list => [...list].sort((a: any, b: any) =>
        String(a.id).localeCompare(String(b.id), 'de', { sensitivity: 'base' })
      ))
    );
  }
}
