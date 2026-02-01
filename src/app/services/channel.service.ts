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

/**
 * Service for managing channels (creation, membership, messages)
 */
@Injectable({ providedIn: 'root' })
export class ChannelService {
  private fs = inject(Firestore);
  private authReady = inject(AuthReadyService);

  /**
   * Creates a new channel with auto-generated Firestore ID
   * @param name - Display name of the channel
   * @param topic - Optional topic/description of the channel
   * @returns Promise resolving to the generated channel ID
   */
  async createChannel(name: string, topic: string = ''): Promise<string> {
    const user = await this.authReady.requireUser();
    const channelsRef = collection(this.fs, 'channels');
    const docRef = doc(channelsRef);
    const channelId = docRef.id;

    await setDoc(docRef, {
      name,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      memberCount: 0,
      messageCount: 0,
      lastMessageAt: null,
      lastMessageBy: null,
      lastReplyAt: null,
      topic,
    });

    return channelId;
  }

  /**
   * Adds the current user as a member to a channel
   * Increments memberCount only if the member document did not exist before
   * @param channelId - ID of the channel to join
   * @param role - Role of the member ('owner' or 'member')
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

  /**
   * Posts a welcome message to a channel from the bot
   * @param channelId - ID of the channel to post welcome message
   */
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

  /**
   * Removes the current user from a channel and decrements member count
   * @param channelId - ID of the channel to leave
   */
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

  /**
   * Returns an observable stream of all channels, sorted alphabetically by name
   * @returns Observable of channel documents array sorted by name
   */
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
