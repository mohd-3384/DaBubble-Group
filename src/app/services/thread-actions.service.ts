import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { deleteDoc, deleteField, doc, Firestore, increment, runTransaction, updateDoc } from '@angular/fire/firestore';
import { Message, ReactionVm, MentionUser } from '../interfaces/allInterfaces.interface';
import { ChatRefreshService } from './chat-refresh.service';

@Injectable({
  providedIn: 'root'
})
export class ThreadActionsService {
  private fs = inject(Firestore);
  private chatRefresh = inject(ChatRefreshService);
  private env = inject(EnvironmentInjector);

  /**
   * Saves an edited message to Firestore
   * @param messageId - The ID of the message to edit
   * @param rootMessageId - The ID of the root message
   * @param channelId - The channel or conversation ID
   * @param newText - The new text content
   * @param isDM - Whether this is a direct message
   * @param isRoot - Whether this is the root message
   * @returns Promise that resolves when the edit is saved
   */
  async saveMessageEdit(
    messageId: string,
    rootMessageId: string,
    channelId: string,
    newText: string,
    isDM: boolean,
    isRoot: boolean
  ): Promise<void> {
    const ref = this.getMessageRef(messageId, rootMessageId, channelId, isDM, isRoot);

    await updateDoc(ref, {
      text: newText,
      editedAt: new Date(),
    });

    this.chatRefresh.refreshReactions();
  }

  /**
   * Deletes a message (root or reply)
   * @param messageId - The ID of the message to delete
   * @param rootMessageId - The ID of the root message
   * @param channelId - The channel or conversation ID
   * @param isDM - Whether this is a direct message
   * @param isRoot - Whether this is the root message
   */
  async deleteMessage(
    messageId: string,
    rootMessageId: string,
    channelId: string,
    isDM: boolean,
    isRoot: boolean
  ): Promise<void> {
    const ref = this.getMessageRef(messageId, rootMessageId, channelId, isDM, isRoot);

    await deleteDoc(ref);
    this.chatRefresh.refreshReactions();
  }

  /**
   * Gets the Firestore document reference for a message
   * @param messageId - The message ID
   * @param rootMessageId - The root message ID
   * @param channelId - The channel or conversation ID
   * @param isDM - Whether this is a direct message
   * @param isRoot - Whether this is the root message
   * @returns Firestore document reference
   */
  private getMessageRef(messageId: string, rootMessageId: string, channelId: string, isDM: boolean, isRoot: boolean) {
    if (isDM) {
      return isRoot
        ? doc(this.fs, `conversations/${channelId}/messages/${rootMessageId}`)
        : doc(this.fs, `conversations/${channelId}/messages/${rootMessageId}/replies/${messageId}`);
    } else {
      return isRoot
        ? doc(this.fs, `channels/${channelId}/messages/${rootMessageId}`)
        : doc(this.fs, `channels/${channelId}/messages/${rootMessageId}/replies/${messageId}`);
    }
  }

  /**
   * Toggles a reaction on a message (add or remove)
   * @param messageId - The ID of the message to react to
   * @param rootMessageId - The ID of the root message
   * @param channelId - The channel or conversation ID
   * @param userId - The current user's ID
   * @param emoji - The emoji to toggle
   * @param isDM - Whether this is a direct message
   * @param isRoot - Whether this is the root message
   * @returns Promise that resolves when the reaction is toggled
   */
  async toggleReaction(
    messageId: string,
    rootMessageId: string,
    channelId: string,
    userId: string,
    emoji: string,
    isDM: boolean,
    isRoot: boolean
  ): Promise<void> {
    const ref = this.getMessageRef(messageId, rootMessageId, channelId, isDM, isRoot);

    await runInInjectionContext(this.env, () =>
      runTransaction(this.fs, async (tx) => {
        await this.processReactionToggle(tx, ref, userId, emoji);
      })
    );

    this.chatRefresh.refreshReactions();
  }

  /**
   * Processes the reaction toggle transaction logic
   * @param tx - Firestore transaction
   * @param ref - Message document reference
   * @param userId - User ID toggling the reaction
   * @param emoji - The emoji being toggled
   */
  private async processReactionToggle(tx: any, ref: any, userId: string, emoji: string) {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;

    const data = snap.data() as any;
    const key = String(emoji);
    const already = !!data?.reactionBy?.[key]?.[userId];

    if (already) {
      this.removeReaction(tx, ref, key, userId, data);
    } else {
      this.addReaction(tx, ref, key, userId);
    }
  }

  /**
   * Removes a reaction from a message
   * @param tx - Firestore transaction
   * @param ref - Message document reference
   * @param key - Emoji key
   * @param userId - User ID removing the reaction
   * @param data - Current message data
   */
  private removeReaction(tx: any, ref: any, key: string, userId: string, data: any) {
    const currentCount = Number(data?.reactions?.[key] ?? 0);
    const updatePayload: any = {
      [`reactionBy.${key}.${userId}`]: deleteField(),
    };

    if (currentCount <= 1) updatePayload[`reactions.${key}`] = deleteField();
    else updatePayload[`reactions.${key}`] = increment(-1);

    tx.update(ref, updatePayload);
  }

  /**
   * Adds a reaction to a message
   * @param tx - Firestore transaction
   * @param ref - Message document reference
   * @param key - Emoji key
   * @param userId - User ID adding the reaction
   */
  private addReaction(tx: any, ref: any, key: string, userId: string) {
    tx.update(ref, {
      [`reactionBy.${key}.${userId}`]: true,
      [`reactions.${key}`]: increment(1),
    });
  }

  /**
   * Converts reaction data to view model format
   * @param message - The message with reactions
   * @param currentUserId - The current user's ID
   * @returns Array of reaction view models
   */
  getReactionsForMessage(message: Message, currentUserId: string | null): ReactionVm[] {
    const raw = (message as any)?.reactions;

    if (!raw || typeof raw !== 'object') return [];

    const out: ReactionVm[] = [];
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const emoji = this.emojiToString(k);
      const count = Number(v ?? 0);
      if (!emoji || !Number.isFinite(count) || count <= 0) continue;

      out.push({
        emoji,
        count,
        reactedByMe: this.didUserReact(message, emoji, currentUserId),
      });
    }

    return out.sort((a, b) => b.count - a.count);
  }

  /**
   * Checks if the current user reacted with a specific emoji
   * @param message - The message to check
   * @param emoji - The emoji to check
   * @param currentUserId - The current user's ID
   * @returns True if the user reacted with this emoji
   */
  didUserReact(message: Message, emoji: string, currentUserId: string | null): boolean {
    if (!currentUserId) return false;
    const by = (message as any)?.reactionBy?.[emoji] as Record<string, boolean> | undefined;
    return !!by?.[currentUserId];
  }

  /**
   * Gets the names of users who reacted with a specific emoji
   * @param message - The message to check
   * @param emoji - The emoji to check
   * @param users - List of all users
   * @param currentUserId - The current user's ID
   * @returns Array of user names who reacted
   */
  getReactionUserNames(
    message: Message,
    emoji: string,
    users: MentionUser[],
    currentUserId: string | null
  ): string[] {
    const by = ((message as any)?.reactionBy?.[emoji] || {}) as Record<string, any>;
    const myUid = currentUserId ?? '';

    const names = Object.keys(by)
      .filter((uid) => !!by[uid])
      .map((uid) => {
        if (myUid && uid === myUid) return 'Du';
        return users.find((u) => u.id === uid)?.name ?? 'Unbekannt';
      });

    return names.length ? names : ['Unbekannt'];
  }

  /**
   * Gets the appropriate verb for reaction tooltip
   * @param message - The message to check
   * @param emoji - The emoji to check
   * @param users - List of all users
   * @param currentUserId - The current user's ID
   * @returns Verb string ('hast reagiert', 'hat reagiert', or 'haben reagiert')
   */
  getReactionVerb(
    message: Message,
    emoji: string,
    users: MentionUser[],
    currentUserId: string | null
  ): string {
    const names = this.getReactionUserNames(message, emoji, users, currentUserId);
    const includesYou = names.includes('Du');

    if (includesYou && names.length === 1) return 'hast reagiert';
    return names.length === 1 ? 'hat reagiert' : 'haben reagiert';
  }

  /**
   * Converts various emoji formats to a consistent string format
   * @param x - The emoji input (can be string or object)
   * @returns The emoji as a string
   */
  emojiToString(x: any): string {
    if (typeof x === 'string') return x;

    const native = x?.native ?? x?.emoji?.native ?? x?.emoji?.colons;
    if (typeof native === 'string') return native;

    const s = String(x ?? '');
    return s === '[object Object]' ? '' : s;
  }
}
