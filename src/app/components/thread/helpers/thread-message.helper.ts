import { Injectable } from '@angular/core';
import { Message } from '../../../interfaces/allInterfaces.interface';
import { ThreadUiStateHelper } from './thread-ui-state.helper';

/**
 * Helper service for managing message operations (edit menu, edit mode)
 */
@Injectable()
export class ThreadMessageHelper {
  constructor(private ui: ThreadUiStateHelper) { }

  /**
   * Checks if a message belongs to the current user
   * @param m - The message to check
   * @param currentUserId - Current user ID
   * @returns True if the message author matches current user ID
   */
  isOwnMessage(m: { author?: { id?: string } } | null | undefined, currentUserId: string | null): boolean {
    return !!currentUserId && String(m?.author?.id ?? '') === currentUserId;
  }

  /**
   * Toggles the edit menu for a message
   * @param ev - The mouse event
   * @param m - The message to edit
   * @param currentUserId - Current user ID
   */
  toggleEditMenu(ev: MouseEvent, m: Message, currentUserId: string | null) {
    ev.stopPropagation();
    if (!this.isOwnMessage(m, currentUserId)) return;
    if (this.ui.editingMessageId === m.id) return;
    const willOpen = this.ui.editMenuForId !== m.id;
    this.ui.editMenuForId = willOpen ? m.id : null;
    if (willOpen) this.ui.messageEmojiForId = null;
    this.ui.showEmoji = false;
    this.ui.showUsers = false;
    if (willOpen) this.ui.hoveredRowId = m.id;
  }

  /**
   * Starts editing a message
   * @param m - The message to edit
   * @param currentUserId - Current user ID
   */
  startEdit(m: Message, currentUserId: string | null) {
    if (!this.isOwnMessage(m, currentUserId)) return;
    this.ui.startEdit(m.id, (m.text ?? '').toString());
  }

  /**
   * Finds a message by ID in root message or replies
   * @param id - The message ID to find
   * @param rootMessage - The root message
   * @param replies - Array of reply messages
   * @returns The found message
   * @throws Error if message not found
   */
  findMessageById(id: string, rootMessage: Message, replies: Message[]): Message {
    if (rootMessage?.id === id) return rootMessage;
    const reply = replies.find((r) => r.id === id);
    if (!reply) throw new Error(`Message with id ${id} not found`);
    return reply;
  }
}
