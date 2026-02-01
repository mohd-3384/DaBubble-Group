import { Injectable, ChangeDetectorRef } from '@angular/core';
import { Message } from '../../../interfaces/allInterfaces.interface';
import { ThreadActionsService } from '../../../services/thread-actions.service';
import { ThreadUiStateHelper } from './thread-ui-state.helper';

/**
 * Helper service for thread message editing operations
 * Handles message edit save and state management
 */
@Injectable()
export class ThreadEditHelper {
  constructor(
    private threadActions: ThreadActionsService,
    private ui: ThreadUiStateHelper,
    private cdr: ChangeDetectorRef
  ) { }

  /**
   * Checks if the edit should be saved
   * @param m - The message being edited
   * @param next - The new text
   * @returns True if edit should be saved
   */
  shouldSaveEdit(m: Message, next: string): boolean {
    return !!next && next !== (m.text ?? '').toString();
  }

  /**
   * Performs the save operation for edited message
   * @param m - The message being edited
   * @param next - The new text
   * @param rootMessage - The root message
   * @param channelId - The channel ID
   * @param isDM - Whether this is a direct message
   */
  async performSaveEdit(
    m: Message,
    next: string,
    rootMessage: Message,
    channelId: string,
    isDM: boolean
  ) {
    try {
      const isRoot = m.id === rootMessage.id;
      await this.saveToFirestore(m, next, rootMessage, channelId, isDM, isRoot);
      this.updateLocalMessage(m, next);
    } catch (err) {
      console.error('[Thread] Failed to save edit:', err);
    }
  }

  /**
   * Saves edited message to Firestore
   * @param m - The message being edited
   * @param next - The new text
   * @param rootMessage - The root message
   * @param channelId - The channel ID
   * @param isDM - Whether this is a direct message
   * @param isRoot - Whether this is the root message
   */
  private async saveToFirestore(
    m: Message,
    next: string,
    rootMessage: Message,
    channelId: string,
    isDM: boolean,
    isRoot: boolean
  ) {
    await this.threadActions.saveMessageEdit(
      m.id,
      rootMessage.id,
      channelId,
      next,
      isDM,
      isRoot
    );
  }

  /**
   * Updates the local message object with new text
   * @param m - The message being edited
   * @param next - The new text
   */
  private updateLocalMessage(m: Message, next: string) {
    m.text = next;
    (m as any).editedAt = new Date();
  }

  /**
   * Resets all edit-related UI state
   */
  resetEditState() {
    this.ui.editingMessageId = null;
    this.ui.editDraft = '';
    this.ui.editEmojiForId = null;
    this.ui.hoveredRowId = null;
    this.ui.popoverHoverForId = null;
    this.ui.editMenuForId = null;
    this.cdr.markForCheck();
  }
}
