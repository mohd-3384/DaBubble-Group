import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  docData,
  setDoc,
  serverTimestamp,
  runTransaction,
  increment,
  collection,
  addDoc,
  collectionData,
  getDoc,
  writeBatch,
  getDocs,
  deleteDoc,
  query,
  where,
  limit,
} from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, combineLatest, map, firstValueFrom, of, switchMap, catchError, startWith } from 'rxjs';
import { ChannelDoc, UserDoc } from '../interfaces/allInterfaces.interface';
import { AuthReadyService } from './auth-ready.service';

/**
 * Service for managing channels (creation, membership, messages)
 */
@Injectable({ providedIn: 'root' })
export class ChannelService {
  private fs = inject(Firestore);
  private auth = inject(Auth);
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
   * Adds the current user as member to a channel by its name (exact match)
   * @param name - Channel display name
   */
  async addMeToChannelByName(name: string): Promise<void> {
    const snap = await getDocs(
      query(collection(this.fs, 'channels'), where('name', '==', name), limit(1))
    );
    const docSnap = snap.docs[0];
    if (!docSnap) return;
    await this.addMeAsMember(docSnap.id, 'member');
  }

  /**
   * Adds multiple users as members to a channel.
   * @param channelId - ID of the channel
   * @param members - Users to add
   * @param role - Role for added members
   */
  async addMembers(channelId: string, members: UserDoc[], role: 'owner' | 'member' = 'member'): Promise<void> {
    const unique = new Map<string, UserDoc>();
    for (const m of members) {
      if (m?.id) unique.set(m.id, m);
    }
    const list = Array.from(unique.values());
    if (!list.length) return;

    const chRef = doc(this.fs, `channels/${channelId}`);
    const batch = writeBatch(this.fs);
    for (const u of list) {
      const memRef = doc(this.fs, `channels/${channelId}/members/${u.id}`);
      batch.set(
        memRef,
        {
          uid: u.id,
          displayName: u.name,
          avatarUrl: u.avatarUrl ?? null,
          joinedAt: serverTimestamp(),
          role,
        },
        { merge: true }
      );
    }
    batch.update(chRef, { memberCount: increment(list.length) });
    await batch.commit();
  }

  /**
   * Posts a welcome message to a channel from the bot
   * @param channelId - ID of the channel to post welcome message
   */
  async postWelcome(channelId: string): Promise<void> {
    const user = await this.authReady.requireUser()
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
    let shouldDelete = false;
    await runTransaction(this.fs, async (tx) => {
      const chSnap = await tx.get(chRef);
      const memSnap = await tx.get(memRef);
      if (memSnap.exists()) {
        tx.delete(memRef);
        const memberCount = (chSnap.data() as any)?.memberCount ?? 0;
        if (memberCount <= 1) {
          tx.delete(chRef);
          shouldDelete = true;
        } else {
          tx.update(chRef, { memberCount: increment(-1) });
        }
      }
    });

    if (shouldDelete) {
      await this.deleteChannelData(channelId);
    }
  }

  /**
   * Deletes channel subcollections (members, messages, replies).
   */
  private async deleteChannelData(channelId: string): Promise<void> {
    try {
      await this.deleteCollection(`channels/${channelId}/members`);

      const messagesRef = collection(this.fs, `channels/${channelId}/messages`);
      const msgSnap = await getDocs(messagesRef);
      for (const msg of msgSnap.docs) {
        await this.deleteCollection(`channels/${channelId}/messages/${msg.id}/replies`);
        await deleteDoc(doc(this.fs, `channels/${channelId}/messages/${msg.id}`));
      }
    } catch (e) {
      console.error('[ChannelService] Cleanup failed:', e);
    }
  }

  /**
   * Deletes all documents in a collection path in batches.
   */
  private async deleteCollection(path: string): Promise<void> {
    const ref = collection(this.fs, path);
    const snap = await getDocs(ref);
    if (snap.empty) return;

    let batch = writeBatch(this.fs);
    let count = 0;
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
      count += 1;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(this.fs);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
  }

  /**
   * Checks whether the current user is a member of a channel
   * @param channelId - ID of the channel
   * @returns True if member document exists
   */
  async isCurrentUserMember(channelId: string): Promise<boolean> {
    try {
      const user = await this.authReady.requireUser();
      const memRef = doc(this.fs, `channels/${channelId}/members/${user.uid}`);
      const memSnap = await getDoc(memRef);
      return memSnap.exists();
    } catch {
      return false;
    }
  }

  /**
   * Returns an observable stream of all channels, sorted alphabetically by name
   * @returns Observable of channel documents array sorted by name
   */
  channels$(): Observable<ChannelDoc[]> {
    const ref = collection(this.fs, 'channels');
    return authState(this.auth).pipe(
      switchMap((user) => {
        if (!user) return of([] as ChannelDoc[]);
        return (collectionData(ref, { idField: 'id' }) as Observable<ChannelDoc[]>).pipe(
          switchMap((list) => this.filterChannelsByMembership(list, user.uid)),
          catchError(() => of([] as ChannelDoc[]))
        );
      }),
      startWith([] as ChannelDoc[])
    );
  }

  /**
   * Filters channels by checking for a member document per channel.
   * @param list - Channel list
   * @param uid - User ID
   */
  private filterChannelsByMembership(list: ChannelDoc[], uid: string): Observable<ChannelDoc[]> {
    if (!list?.length) return of([] as ChannelDoc[]);

    const checks$ = list.map((ch) => {
      if (!ch?.id) return of({ channel: ch, isMember: false });
      const memRef = doc(this.fs, `channels/${ch.id}/members/${uid}`);
      return docData(memRef).pipe(
        map((data) => ({ channel: ch, isMember: !!data })),
        catchError(() => of({ channel: ch, isMember: false }))
      );
    });

    return combineLatest(checks$).pipe(
      map((rows) =>
        rows
          .filter((r) => r.isMember)
          .map((r) => r.channel)
          .sort((a: any, b: any) =>
            String(a.name ?? '').localeCompare(String(b.name ?? ''), 'de', { sensitivity: 'base' })
          )
      )
    );
  }

  /**
   * Checks if a channel name already exists (case-insensitive)
   * @param name - Channel name to check
   * @param excludeId - Optional channel ID to exclude from check
   * @returns True if a duplicate exists
   */
  async isChannelNameTaken(name: string, excludeId?: string): Promise<boolean> {
    const normalized = this.normalizeName(name);
    if (!normalized) return false;
    try {
      const ref = collection(this.fs, 'channels');
      const list = await firstValueFrom(
        collectionData(ref, { idField: 'id' }) as Observable<ChannelDoc[]>
      );
      return list.some(
        (ch) =>
          this.normalizeName(String(ch.name ?? '')) === normalized &&
          (!excludeId || ch.id !== excludeId)
      );
    } catch {
      return false;
    }
  }

  /**
   * Normalizes channel names for comparison
   * @param name - Channel name
   * @returns Normalized name
   */
  private normalizeName(name: string): string {
    return String(name || '')
      .trim()
      .replace(/^#+/, '')
      .toLowerCase();
  }
}
