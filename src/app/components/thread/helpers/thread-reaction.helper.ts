import { Injectable } from '@angular/core';
import { Message } from '../../../interfaces/allInterfaces.interface';
import { ThreadActionsService } from '../../../services/thread-actions.service';

/**
 * Helper service for thread reaction operations
 * Handles reaction toggling and emoji processing
 */
@Injectable()
export class ThreadReactionHelper {
  constructor(private threadActions: ThreadActionsService) { }

  /**
   * Toggles a reaction on a message
   * @param m - The message
   * @param emojiInput - The emoji to toggle
   * @param ctx - Context ('root' or 'reply')
   * @param rootMessage - The root message
   * @param channelId - The channel ID
   * @param currentUserId - Current user ID
   * @param isDM - Whether this is a direct message
   */
  async toggleReaction(
    m: Message,
    emojiInput: any,
    ctx: 'root' | 'reply',
    rootMessage: Message,
    channelId: string,
    currentUserId: string | null,
    isDM: boolean
  ) {
    if (!this.validateReaction(currentUserId, emojiInput)) return;
    await this.performReactionToggle(m, emojiInput, ctx, rootMessage, channelId, currentUserId!, isDM);
  }

  /**
   * Validates reaction prerequisites
   * @param currentUserId - Current user ID
   * @param emojiInput - The emoji input
   * @returns True if valid
   */
  private validateReaction(currentUserId: string | null, emojiInput: any): boolean {
    if (!currentUserId) return false;
    const emoji = this.threadActions.emojiToString(emojiInput);
    return !!emoji;
  }

  /**
   * Performs the reaction toggle operation
   * @param m - The message
   * @param emojiInput - The emoji to toggle
   * @param ctx - Context ('root' or 'reply')
   * @param rootMessage - The root message
   * @param channelId - The channel ID
   * @param uid - User ID
   * @param isDM - Whether this is a direct message
   */
  private async performReactionToggle(
    m: Message,
    emojiInput: any,
    ctx: 'root' | 'reply',
    rootMessage: Message,
    channelId: string,
    uid: string,
    isDM: boolean
  ) {
    const emoji = this.threadActions.emojiToString(emojiInput);
    if (!emoji) return;
    try {
      await this.threadActions.toggleReaction(
        m.id,
        rootMessage.id,
        channelId,
        uid,
        emoji,
        isDM,
        ctx === 'root'
      );
    } catch (err) {
      console.error('[Thread] Reaction update failed:', err);
    }
  }

  /**
   * Converts emoji selection event to string
   * @param e - The emoji selection event
   * @returns Emoji string or null
   */
  emojiToString(e: any): string | null {
    return this.threadActions.emojiToString(e?.emoji?.native ?? e?.emoji ?? e);
  }
}
