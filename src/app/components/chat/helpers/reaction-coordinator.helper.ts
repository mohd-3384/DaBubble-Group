import { Injectable, inject } from '@angular/core';
import { ChatStateHelper } from './chat-state.helper';
import { ReactionHelper } from './reaction.helper';
import { MessageVm } from '../../../interfaces/allInterfaces.interface';

/**
 * Helper for coordinating reaction operations
 */
@Injectable()
export class ReactionCoordinatorHelper {
  private state = inject(ChatStateHelper);
  private reaction = inject(ReactionHelper);

  /**
   * Adds a reaction to a message
   * @param m - Message
   * @param emoji - Emoji to add
   */
  async addReactionToMessage(m: MessageVm, emoji: string): Promise<void> {
    await this.reaction.addReaction(m, emoji, this.state.currentUser);
  }

  /**
   * Handles reaction chip click
   * @param ev - Mouse event
   * @param m - Message
   * @param emoji - Emoji
   */
  onReactionChipClick(ev: MouseEvent, m: MessageVm, emoji: string): void {
    ev.stopPropagation();
    this.addReactionToMessage(m, emoji);
  }

  /**
   * Checks if message has reactions
   * @param m - Message
   * @returns True if has reactions
   */
  hasReactions(m: MessageVm): boolean {
    return this.reaction.hasReactions(m);
  }

  /**
   * Gets reaction list
   * @param m - Message
   * @returns Reaction array
   */
  reactionList(m: MessageVm): Array<{ emoji: string; count: number }> {
    return this.reaction.reactionList(m);
  }

  /**
   * Checks if user reacted
   * @param m - Message
   * @param emoji - Emoji
   * @param uid - User ID
   * @returns True if user reacted
   */
  hasUserReacted(m: MessageVm, emoji: string, uid: string): boolean {
    return this.reaction.hasUserReacted(m, emoji, uid);
  }

  /**
   * Gets reaction user names
   * @param m - Message
   * @param emoji - Emoji
   * @returns Array of names
   */
  reactionNames(m: MessageVm, emoji: string): string[] {
    return this.reaction.reactionNames(
      m,
      emoji,
      this.state.getUserNameMap(),
      this.state.currentUser?.id ?? null
    );
  }

  /**
   * Gets reaction verb
   * @param m - Message
   * @param emoji - Emoji
   * @returns Verb text
   */
  reactionVerb(m: MessageVm, emoji: string): string {
    return this.reaction.reactionVerb(
      m,
      emoji,
      this.state.getUserNameMap(),
      this.state.currentUser?.id ?? null
    );
  }

  /**
   * Handles reaction hover
   * @param m - Message or null
   * @param emoji - Optional emoji
   */
  onReactionHover(m: MessageVm | null, emoji?: string): void {
    if (m && emoji) {
      this.state.hoveredReaction = { msgId: m.id, emoji };
    } else {
      this.state.hoveredReaction = null;
    }
  }

  /**
   * Checks if reaction is hovered
   * @param m - Message
   * @param emoji - Emoji
   * @returns True if hovered
   */
  isReactionHovered(m: MessageVm, emoji: string): boolean {
    return (
      !!this.state.hoveredReaction &&
      this.state.hoveredReaction.msgId === m.id &&
      this.state.hoveredReaction.emoji === emoji
    );
  }
}
