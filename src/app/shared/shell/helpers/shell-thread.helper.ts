import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, setDoc, increment, serverTimestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { ChatRefreshService } from '../../../services/chat-refresh.service';
import { UserDoc } from '../../../interfaces/allInterfaces.interface';

/**
 * Helper service for shell thread operations
 * Handles thread message sending and editing
 */
@Injectable({ providedIn: 'root' })
export class ShellThreadHelper {
  private fs = inject(Firestore);
  private auth = inject(Auth);
  private chatRefresh = inject(ChatRefreshService);

  /**
   * Validates thread state
   * @param vm - Thread view model
   * @returns True if valid
   */
  validateThreadState(vm: any): boolean {
    if (!vm?.open || !vm.root?.id) {
      console.warn('[Thread] Kein offener Thread oder keine rootMessage.id');
      return false;
    }
    return true;
  }

  /**
   * Validates channel ID
   * @param channelId - Channel ID to validate
   * @returns True if valid
   */
  validateChannelId(channelId: string | null | undefined): boolean {
    if (!channelId) {
      console.warn('[Thread] Kein channelId gefunden. Prüfe deine Thread-VM');
      return false;
    }
    return true;
  }

  /**
   * Validates authenticated user
   * @param authUser - Auth user to validate
   * @returns True if valid
   */
  validateAuthUser(authUser: any): boolean {
    if (!authUser) {
      console.warn('[Thread] Kein Auth-User vorhanden, Reply wird nicht gesendet.');
      return false;
    }
    return true;
  }

  /**
   * Gets author data for message
   * @param authUser - Authenticated user
   * @param currentUser - Current user document
   * @returns Author data object
   */
  getAuthorData(authUser: any, currentUser: (UserDoc & { id: string }) | null) {
    const guestEmail = 'guest@dabubble.de';
    const isGuest = (currentUser as any)?.role === 'guest' || authUser.email === guestEmail;

    return {
      authorId: authUser.uid,
      authorName: this.getAuthorName(isGuest, authUser, currentUser),
      authorAvatar: currentUser?.avatarUrl ?? '/public/images/avatars/avatar1.svg',
    };
  }

  /**
   * Gets author name based on guest status
   * @param isGuest - Whether user is guest
   * @param authUser - Authenticated user
   * @param currentUser - Current user document
   * @returns Author name
   */
  private getAuthorName(
    isGuest: boolean,
    authUser: any,
    currentUser: (UserDoc & { id: string }) | null
  ): string {
    if (isGuest) return 'Guest';
    return currentUser?.name ??
      (currentUser as any)?.displayName ??
      authUser.displayName ??
      authUser.email ??
      'Unbekannt';
  }

  /**
   * Saves reply message to Firestore
   * @param msg - Message text
   * @param channelId - Channel ID
   * @param messageId - Parent message ID
   * @param isDM - Whether this is a direct message
   * @param authorData - Author information
   */
  async saveReply(
    msg: string,
    channelId: string,
    messageId: string,
    isDM: boolean,
    authorData: { authorId: string; authorName: string; authorAvatar: string }
  ) {
    try {
      const { repliesRef, parentRef } = this.getReplyRefs(channelId, messageId, isDM);
      await this.addReplyDoc(repliesRef, msg, authorData);
      await this.updateParentReplyCount(parentRef);
    } catch (err) {
      console.error('[Thread] Fehler beim Speichern der Reply:', err);
    }
  }

  /**
   * Gets Firestore references for reply and parent message
   * @param channelId - Channel ID
   * @param messageId - Message ID
   * @param isDM - Whether this is a direct message
   * @returns Object with repliesRef and parentRef
   */
  private getReplyRefs(channelId: string, messageId: string, isDM: boolean) {
    if (isDM) {
      return {
        repliesRef: collection(this.fs, `conversations/${channelId}/messages/${messageId}/replies`),
        parentRef: doc(this.fs, `conversations/${channelId}/messages/${messageId}`),
      };
    }
    return {
      repliesRef: collection(this.fs, `channels/${channelId}/messages/${messageId}/replies`),
      parentRef: doc(this.fs, `channels/${channelId}/messages/${messageId}`),
    };
  }

  /**
   * Adds reply document to Firestore
   * @param repliesRef - Collection reference for replies
   * @param msg - Message text
   * @param authorData - Author information
   */
  private async addReplyDoc(
    repliesRef: any,
    msg: string,
    authorData: { authorId: string; authorName: string; authorAvatar: string }
  ) {
    await addDoc(repliesRef, {
      text: msg,
      ...authorData,
      createdAt: serverTimestamp(),
      reactions: {},
      reactionBy: {},
    });
  }

  /**
   * Updates parent message reply count
   * @param parentRef - Document reference for parent message
   */
  private async updateParentReplyCount(parentRef: any) {
    await updateDoc(parentRef, {
      replyCount: increment(1),
      lastReplyAt: serverTimestamp(),
    }).catch(async (err) => this.handleReplyCountError(err, parentRef));
  }

  /**
   * Handles reply count update errors
   * @param err - Error object
   * @param parentRef - Parent message reference
   */
  private async handleReplyCountError(err: any, parentRef: any) {
    if (err.code === 'not-found') {
      await setDoc(parentRef, {
        replyCount: 1,
        lastReplyAt: serverTimestamp(),
      }, { merge: true });
    } else {
      throw err;
    }
  }

  /**
   * Edits a message (root or reply)
   * @param ev - Event containing messageId and new text
   * @param channelId - Channel ID
   * @param rootId - Root message ID
   * @param isDM - Whether this is a direct message
   * @param makeConvId - Function to create conversation ID
   */
  async editMessage(
    ev: { messageId: string; text: string },
    channelId: string,
    rootId: string,
    isDM: boolean,
    makeConvId: (a: string, b: string) => string
  ) {
    try {
      if (ev.messageId === rootId) {
        await this.editRootMessage(ev.text, channelId, rootId, isDM, makeConvId);
      } else {
        await this.editReplyMessage(ev, channelId, rootId, isDM, makeConvId);
      }
    } catch (e) {
      console.error('[Thread] Fehler beim Speichern der Edit:', e);
    }
  }

  /**
   * Edits the root message
   * @param text - New message text
   * @param channelId - Channel ID
   * @param rootId - Root message ID
   * @param isDM - Whether this is a direct message
   * @param makeConvId - Function to create conversation ID
   */
  private async editRootMessage(
    text: string,
    channelId: string,
    rootId: string,
    isDM: boolean,
    makeConvId: (a: string, b: string) => string
  ) {
    const ref = this.getRootMessageRef(channelId, rootId, isDM, makeConvId);
    await updateDoc(ref, { text, editedAt: serverTimestamp() });
    this.chatRefresh.refresh();
  }

  /**
   * Edits a reply message
   * @param ev - Event containing messageId and new text
   * @param channelId - Channel ID
   * @param rootId - Root message ID
   * @param isDM - Whether this is a direct message
   * @param makeConvId - Function to create conversation ID
   */
  private async editReplyMessage(
    ev: { messageId: string; text: string },
    channelId: string,
    rootId: string,
    isDM: boolean,
    makeConvId: (a: string, b: string) => string
  ) {
    const ref = this.getReplyMessageRef(channelId, rootId, ev.messageId, isDM, makeConvId);
    await updateDoc(ref, { text: ev.text, editedAt: serverTimestamp() });
  }

  /**
   * Gets Firestore reference for root message
   * @param channelId - Channel ID
   * @param rootId - Root message ID
   * @param isDM - Whether this is a direct message
   * @param makeConvId - Function to create conversation ID
   * @returns Document reference
   */
  private getRootMessageRef(
    channelId: string,
    rootId: string,
    isDM: boolean,
    makeConvId: (a: string, b: string) => string
  ) {
    if (isDM) {
      const convId = makeConvId(this.auth.currentUser!.uid, channelId);
      return doc(this.fs, `conversations/${convId}/messages/${rootId}`);
    }
    return doc(this.fs, `channels/${channelId}/messages/${rootId}`);
  }

  /**
   * Gets Firestore reference for reply message
   * @param channelId - Channel ID
   * @param rootId - Root message ID
   * @param messageId - Reply message ID
   * @param isDM - Whether this is a direct message
   * @param makeConvId - Function to create conversation ID
   * @returns Document reference
   */
  private getReplyMessageRef(
    channelId: string,
    rootId: string,
    messageId: string,
    isDM: boolean,
    makeConvId: (a: string, b: string) => string
  ) {
    if (isDM) {
      const convId = makeConvId(this.auth.currentUser!.uid, channelId);
      return doc(this.fs, `conversations/${convId}/messages/${rootId}/replies/${messageId}`);
    }
    return doc(this.fs, `channels/${channelId}/messages/${rootId}/replies/${messageId}`);
  }
}
