import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, docData, setDoc, updateDoc, deleteField, increment, runTransaction } from '@angular/fire/firestore';
import { MessageVm } from '../interfaces/allInterfaces.interface';
import { AuthReadyService } from '../services/auth-ready.service';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs/operators';

/**
 * Helper class for managing emoji picker and reactions in the chat component.
 * Handles emoji selection, reactions, and emoji popover positioning.
 */
@Injectable()
export class ChatEmojiHelper {
  private fs = inject(Firestore);
  private authReady = inject(AuthReadyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private env = inject(EnvironmentInjector);

  emojiMartCfg = {
    showPreview: false,
    showSkinTones: false,
    autoFocus: true,
  };

  /**
   * Converts emoji event object to string.
   * @param e - Emoji event object
   * @returns Emoji as string
   */
  asEmojiString(e: any): string {
    return (
      e?.emoji?.native ??
      e?.native ??
      e?.emoji?.char ??
      e?.char ??
      (typeof e === 'string' ? e : '')
    );
  }

  /**
   * Checks if a user has reacted with a specific emoji.
   * @param m - The message
   * @param emoji - The emoji to check
   * @param uid - The user ID
   * @returns True if the user has reacted
   */
  hasUserReacted(m: MessageVm, emoji: string, uid: string): boolean {
    const by = (m as any)?.reactionBy || {};
    return !!by?.[emoji]?.[uid];
  }

  /**
   * Gets the list of reactions for a message.
   * @param m - The message
   * @returns Array of reactions with emoji and count
   */
  reactionList(m: MessageVm): { emoji: string; count: number }[] {
    const reactions = (m as any).reactions || {};
    return Object.entries(reactions)
      .filter(([_, count]) => (count as number) > 0)
      .map(([emoji, count]) => ({ emoji, count: count as number }));
  }

  /**
   * Checks if a message has any reactions.
   * @param m - The message
   * @returns True if the message has reactions
   */
  hasReactions(m: MessageVm): boolean {
    return this.reactionList(m).length > 0;
  }

  /**
   * Gets the names of users who reacted with a specific emoji.
   * @param m - The message
   * @param emoji - The emoji
   * @param currentUser - The current user
   * @param userNameMap - Map of user IDs to names
   * @returns Array of user names
   */
  reactionNames(
    m: MessageVm,
    emoji: string,
    currentUser: any,
    userNameMap: Map<string, string>
  ): string[] {
    const by = ((m as any)?.reactionBy?.[emoji] || {}) as Record<string, any>;
    const myUid = currentUser?.id ?? '';

    const names = Object.keys(by)
      .filter(uid => !!by[uid])
      .map(uid => {
        if (myUid && uid === myUid) return 'Du';
        return userNameMap.get(uid) ?? 'Unbekannt';
      });

    return names.length ? names : ['Unbekannt'];
  }

  /**
   * Gets the verb for reaction tooltip (singular or plural).
   * @param m - The message
   * @param emoji - The emoji
   * @param currentUser - The current user
   * @param userNameMap - Map of user IDs to names
   * @returns The appropriate verb
   */
  reactionVerb(
    m: MessageVm,
    emoji: string,
    currentUser: any,
    userNameMap: Map<string, string>
  ): string {
    const names = this.reactionNames(m, emoji, currentUser, userNameMap);
    const includesYou = names.includes('Du');

    if (includesYou && names.length === 1) return 'hast reagiert';
    return names.length === 1 ? 'hat reagiert' : 'haben reagiert';
  }

  /**
   * Adds or removes a reaction to a message.
   * @param msg - The message
   * @param emoji - The emoji
   * @param currentUser - The current user
   * @param makeConvId - Function to create conversation ID
   * @returns Promise that resolves when the reaction is updated
   */
  async addReactionToMessage(
    msg: MessageVm,
    emoji: string,
    currentUser: any,
    makeConvId: (uid1: string, uid2: string) => string
  ): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    const authUser = await this.authReady.requireUser();

    if (!currentUser?.id) {
      console.warn('[Chat] Kein Current User -> Reaction abgebrochen');
      return;
    }

    const isDM = this.router.url.includes('/dm/');

    try {
      if (isDM) {
        const otherUserId = id;
        const convId = makeConvId(authUser.uid, otherUserId);
        const ref = doc(this.fs, `conversations/${convId}/messages/${msg.id}`);

        await runTransaction(this.fs, async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists()) return;

          const data = snap.data();
          const reactions = data['reactions'] || {};
          const reactionBy = data['reactionBy'] || {};

          const hasReacted = !!reactionBy?.[emoji]?.[currentUser.id];

          if (hasReacted) {
            const newCount = Math.max(0, (reactions[emoji] || 0) - 1);
            const updates: any = {};

            if (newCount <= 0) {
              updates[`reactions.${emoji}`] = deleteField();
              updates[`reactionBy.${emoji}`] = deleteField();
            } else {
              updates[`reactions.${emoji}`] = newCount;
              updates[`reactionBy.${emoji}.${currentUser.id}`] = deleteField();
            }

            tx.update(ref, updates);
          } else {
            tx.update(ref, {
              [`reactions.${emoji}`]: increment(1),
              [`reactionBy.${emoji}.${currentUser.id}`]: true,
            });
          }
        });
      } else {
        const ref = doc(this.fs, `channels/${id}/messages/${msg.id}`);

        await runTransaction(this.fs, async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists()) return;

          const data = snap.data();
          const reactions = data['reactions'] || {};
          const reactionBy = data['reactionBy'] || {};

          const hasReacted = !!reactionBy?.[emoji]?.[currentUser.id];

          if (hasReacted) {
            const newCount = Math.max(0, (reactions[emoji] || 0) - 1);
            const updates: any = {};

            if (newCount <= 0) {
              updates[`reactions.${emoji}`] = deleteField();
              updates[`reactionBy.${emoji}`] = deleteField();
            } else {
              updates[`reactions.${emoji}`] = newCount;
              updates[`reactionBy.${emoji}.${currentUser.id}`] = deleteField();
            }

            tx.update(ref, updates);
          } else {
            tx.update(ref, {
              [`reactions.${emoji}`]: increment(1),
              [`reactionBy.${emoji}.${currentUser.id}`]: true,
            });
          }
        });
      }
    } catch (err) {
      console.error('[Chat] Fehler beim Hinzufügen/Entfernen der Reaktion:', err);
      throw err;
    }
  }

  /**
   * Positions the emoji popover for a message.
   * @param btn - The button element that triggered the picker
   * @param placement - Preferred placement ('top' or 'bottom')
   * @returns Position object with top, left, and placement
   */
  positionEmojiPopover(
    btn: HTMLElement,
    placement: 'top' | 'bottom' = 'bottom'
  ): { top: number; left: number; placement: 'top' | 'bottom' } {
    const rect = btn.getBoundingClientRect();
    const pickerWidth = 360;
    const pickerHeight = 360;
    const offset = 10;

    const viewportW = window.innerWidth || document.documentElement.clientWidth;
    const viewportH = window.innerHeight || document.documentElement.clientHeight;

    let left = rect.left + rect.width / 2 - pickerWidth / 2;
    left = Math.max(10, Math.min(left, viewportW - pickerWidth - 10));

    const roomBelow = viewportH - rect.bottom;
    const placeAbove = placement === 'top' || roomBelow < pickerHeight + offset;

    let top = placeAbove
      ? rect.top - pickerHeight - offset
      : rect.bottom + offset;

    top = Math.max(10, Math.min(top, viewportH - pickerHeight - 10));

    return {
      top,
      left,
      placement: placeAbove ? 'top' : 'bottom',
    };
  }

  /**
   * Positions the composer emoji picker.
   * @param btn - The button element
   * @returns Position object with top and left
   */
  positionComposerEmoji(btn: HTMLElement): { top: number; left: number } {
    const rect = btn.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const viewportW = window.innerWidth || document.documentElement.clientWidth;

    const pickerWidth = 360;
    const estimatedHeight = 360;
    const offset = 10;

    let left = Math.max(10, Math.min(rect.left, viewportW - pickerWidth - 10));
    let top = rect.top - estimatedHeight - offset;

    return { top, left };
  }

  /**
   * Track function for reaction list.
   */
  trackReaction = (_: number, r: { emoji: string; count: number }) => r.emoji;
}
