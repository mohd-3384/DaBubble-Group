import { Injectable } from '@angular/core';

/**
 * Helper service for managing thread UI state (popovers, hovers, editing)
 */
@Injectable()
export class ThreadUiStateHelper {
  editingMessageId: string | null = null;
  editDraft = '';

  editMenuForId: string | null = null;

  showEmoji = false;
  showUsers = false;

  messageEmojiForId: string | null = null;
  emojiPopoverPos = { top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' };

  editEmojiForId: string | null = null;
  editEmojiPopoverPos = { top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' };

  hoveredRowId: string | null = null;
  popoverHoverForId: string | null = null;
  leaveTimer: any = null;

  hoveredReaction: { msgId: string; emoji: string } | null = null;

  /**
   * Closes all open popovers and resets hover states
   */
  closePopovers() {
    this.showEmoji = false;
    this.showUsers = false;
    this.messageEmojiForId = null;
    this.editMenuForId = null;
    this.editEmojiForId = null;
    this.popoverHoverForId = null;
    this.hoveredRowId = null;
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
  }

  /**
   * Calculates emoji picker position relative to a button
   * @param btn - The button element that triggered the picker
   * @returns Position object with top, left, and placement
   */
  calculateEmojiPickerPosition(btn: HTMLElement): { top: number; left: number; placement: 'top' | 'bottom' } {
    const rect = btn.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const viewportW = window.innerWidth || document.documentElement.clientWidth;
    const pickerHeight = 360;
    const pickerWidth = 360;
    const offset = 8;
    const roomBelow = viewportH - rect.bottom;
    const placement: 'top' | 'bottom' = roomBelow > pickerHeight + offset ? 'bottom' : 'top';
    const top = placement === 'bottom' ? rect.bottom + offset : rect.top - pickerHeight - offset;
    let left = rect.left;
    const maxLeft = viewportW - pickerWidth - 16;
    if (left > maxLeft) left = Math.max(16, maxLeft);
    return { top, left, placement };
  }

  /**
   * Checks if a message row is currently active (hovered or has open popover)
   * @param id - The message ID
   * @returns True if the row is active
   */
  isRowActive(id: string): boolean {
    const popoverOpen = this.editMenuForId === id || this.messageEmojiForId === id;
    const hoverRow = this.hoveredRowId === id;
    const hoverPopover = this.popoverHoverForId === id;
    return hoverRow || hoverPopover || popoverOpen;
  }

  /**
   * Starts editing a message
   * @param messageId - The message ID
   * @param currentText - The current message text
   */
  startEdit(messageId: string, currentText: string) {
    this.editMenuForId = null;
    this.messageEmojiForId = null;
    this.showEmoji = false;
    this.showUsers = false;
    this.editEmojiForId = null;
    this.editingMessageId = messageId;
    this.editDraft = currentText;
  }

  /**
   * Cancels editing and resets edit state
   * @param messageId - Optional message ID to clean up
   */
  cancelEdit(messageId?: string) {
    const id = messageId ?? this.editingMessageId ?? null;
    this.editingMessageId = null;
    this.editDraft = '';
    this.editEmojiForId = null;
    if (!id) return;
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
    if (this.hoveredRowId === id) this.hoveredRowId = null;
    if (this.popoverHoverForId === id) this.popoverHoverForId = null;
    if (this.editMenuForId === id) this.editMenuForId = null;
    if (this.messageEmojiForId === id) this.messageEmojiForId = null;
  }

  /**
   * Closes message UI elements when interacting with the composer
   */
  closeMessageUi() {
    this.editMenuForId = null;
    this.messageEmojiForId = null;
    this.popoverHoverForId = null;
    this.hoveredRowId = null;
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
  }
}
