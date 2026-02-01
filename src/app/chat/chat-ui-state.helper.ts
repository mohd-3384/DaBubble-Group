import { Injectable } from '@angular/core';

/**
 * Helper class for managing UI state in the chat component.
 * Handles popovers, modals, edit states, and hover states.
 */
@Injectable()
export class ChatUiStateHelper {
  /** Whether the channel info modal is open */
  channelInfoOpen = false;

  /** Whether channel name is being edited */
  channelNameEdit = false;

  /** Whether channel description is being edited */
  channelDescEdit = false;

  /** Edited channel name value */
  editChannelName = '';

  /** Edited channel description value */
  editChannelDesc = '';

  /** Channel topic display text */
  channelTopic = '';

  /** Whether user profile modal is open */
  userProfileOpen = false;

  /** ID of the user whose profile is displayed */
  userProfileId: string | null = null;

  /** User profile data to display */
  userProfile: { name: string; email?: string; avatarUrl: string; status?: string } | null = null;

  /** Whether members modal is open */
  membersModalOpen = false;

  /** Position of members modal */
  membersModalPos = { top: 0, left: 0 };

  /** Whether add members modal is open */
  addMembersOpen = false;

  /** Position of add members modal */
  addMembersModalPos = { top: 0, left: 0 };

  /** Name of member to add */
  addMemberName = '';

  /** Input value for adding member */
  addMemberInput = '';

  /** Whether add member suggestions are shown */
  showAddMemberSuggest = false;

  /** Whether emoji picker is shown */
  showEmoji = false;

  /** Whether members popover is shown */
  showMembers = false;

  /** Position of composer emoji picker */
  composerEmojiPos = { top: 0, left: 0 };

  /** ID of message currently being edited */
  editingMessageId: string | null = null;

  /** Draft text for editing a message */
  editDraft = '';

  /** ID of message showing edit menu */
  editMenuForId: string | null = null;

  /** Position of edit menu popover */
  editMenuPos = { top: 0, left: 0 };

  /** ID of message showing emoji picker */
  messageEmojiForId: string | null = null;

  /** Position of message emoji popover */
  emojiPopoverPos = {
    top: 0,
    left: 0,
    placement: 'bottom' as 'top' | 'bottom',
  };

  /** Context where emoji picker was opened from */
  emojiOpenedFrom: 'actions' | 'reactions' | null = null;

  /** Current emoji context (composer, edit, or null) */
  emojiContext: 'composer' | 'edit' | null = null;

  /** Message target for emoji selection */
  emojiMessageTarget: any = null;

  /** Hovered reaction info */
  hoveredReaction: { msgId: string; emoji: string } | null = null;

  /**
   * Opens the channel info modal.
   */
  openChannelInfoModal(): void {
    this.channelNameEdit = false;
    this.channelDescEdit = false;
    this.channelInfoOpen = true;
  }

  /**
   * Closes the channel info modal.
   */
  closeChannelInfoModal(): void {
    this.channelInfoOpen = false;
    this.channelNameEdit = false;
    this.channelDescEdit = false;
  }

  /**
   * Opens the user profile modal.
   * @param userId - The ID of the user whose profile to display
   */
  openUserProfileModal(userId: string): void {
    this.userProfileOpen = true;
    this.userProfileId = userId;
  }

  /**
   * Closes the user profile modal.
   */
  closeUserProfileModal(): void {
    this.userProfileOpen = false;
    this.userProfile = null;
    this.userProfileId = null;
  }

  /**
   * Opens the members modal.
   */
  openMembersModal(): void {
    this.membersModalOpen = true;
  }

  /**
   * Closes the members modal.
   */
  closeMembersModal(): void {
    this.membersModalOpen = false;
  }

  /**
   * Opens the add members modal.
   */
  openAddMembersModal(): void {
    this.addMembersOpen = true;
  }

  /**
   * Closes the add members modal and resets inputs.
   */
  closeAddMembersModal(): void {
    this.addMembersOpen = false;
    this.addMemberInput = '';
    this.addMemberName = '';
    this.showAddMemberSuggest = false;
  }

  /**
   * Closes all popovers (emoji, members, edit menu).
   */
  closeAllPopovers(): void {
    this.showEmoji = false;
    this.showMembers = false;
    this.messageEmojiForId = null;
    this.editMenuForId = null;
    this.emojiContext = null;
  }

  /**
   * Starts editing a message.
   * @param messageId - ID of the message to edit
   * @param text - Current text of the message
   */
  startEdit(messageId: string, text: string): void {
    this.editMenuForId = null;
    this.messageEmojiForId = null;
    this.showEmoji = false;
    this.showMembers = false;
    this.editingMessageId = messageId;
    this.editDraft = text;
  }

  /**
   * Cancels editing a message.
   */
  cancelEdit(): void {
    this.editingMessageId = null;
    this.editDraft = '';
    this.showEmoji = false;
    this.emojiContext = null;
  }

  /**
   * Positions a modal based on a button element.
   * @param el - The HTML element to position from
   * @param which - Which modal to position ('members' or 'add')
   */
  positionModalFrom(el: HTMLElement, which: 'members' | 'add'): void {
    const rect = el.getBoundingClientRect();
    const offset = 10;

    const viewportW = window.innerWidth;
    const panelWidth = which === 'members' ? 360 : 480;

    const left = Math.min(
      viewportW - panelWidth - 16,
      Math.max(16, rect.right - panelWidth)
    );

    const top = rect.bottom + offset;

    if (which === 'members') {
      this.membersModalPos = { top, left };
    } else {
      this.addMembersModalPos = { top, left };
    }
  }

  /**
   * Positions the edit menu popover.
   * @param btn - The button element that triggered the menu
   */
  positionEditMenu(btn: HTMLElement): void {
    const rect = btn.getBoundingClientRect();
    const popW = 320;
    const offset = 8;

    const viewportW = window.innerWidth || document.documentElement.clientWidth;
    const viewportH = window.innerHeight || document.documentElement.clientHeight;

    let top = rect.bottom + offset - 4;
    let left = rect.left;

    left = Math.min(left, viewportW - popW - 16);
    left = Math.max(16, left);

    const estimatedH = 70;
    if (top + estimatedH > viewportH - 10) {
      top = rect.top - estimatedH - offset;
      top = Math.max(10, top);
    }

    this.editMenuPos = { top, left };
  }

  /**
   * Locks or unlocks body scroll.
   * @param locked - Whether to lock the scroll
   */
  lockBodyScroll(locked: boolean): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = locked ? 'hidden' : '';
  }
}
