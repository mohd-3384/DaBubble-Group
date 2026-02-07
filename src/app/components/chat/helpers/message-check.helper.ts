import { Injectable } from '@angular/core';

/**
 * Helper for message validation and checks
 */
@Injectable()
export class MessageCheckHelper {
  /**
   * Checks if a message belongs to the current user
   * @param m - Message object
   * @param currentUserId - Current user ID
   * @returns True if current user is the author
   */
  isOwnMessage(m: { authorId?: string } | null | undefined, currentUserId: string | null | undefined): boolean {
    return !!currentUserId && !!m?.authorId && m.authorId === currentUserId;
  }

  /**
   * Checks if message has content or attachments
   * @param draft - Draft text
   * @returns True if message can be sent
   */
  canSendMessage(draft: string): boolean {
    return draft.trim().length > 0;
  }

  /**
   * Validates edit draft
   * @param editDraft - Edit draft text
   * @returns True if edit can be saved
   */
  canSaveEdit(editDraft: string): boolean {
    return editDraft.trim().length > 0;
  }
}
