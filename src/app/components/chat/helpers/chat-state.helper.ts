import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MessageVm, SuggestItem, UserDoc, UserMini } from '../../../interfaces/allInterfaces.interface';

/**
 * Manages all UI state for the chat component
 * Centralizes properties to reduce component size
 */
@Injectable()
export class ChatStateHelper {
  // Compose Mode
  composeMode = false;

  // Current User
  currentUser: (UserDoc & { id: string }) | null = null;
  private userNameMap = new Map<string, string>();

  // Emoji - Composer
  showEmoji = false;
  emojiContext: 'composer' | 'message' | 'edit' | null = null;
  emojiMessageTarget: MessageVm | null = null;
  composerEmojiPos = { top: 0, left: 0 };

  // Emoji - Message Popover
  messageEmojiForId: string | null = null;
  emojiPopoverPos = { top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' };
  emojiOpenedFrom: 'actions' | 'reactions' | null = null;

  // Edit Menu
  editMenuForId: string | null = null;
  editMenuPos = { top: 0, left: 0 };

  // Message Editing
  editingMessageId: string | null = null;
  editDraft = '';

  // Composer
  to = '';
  private toInput$ = new BehaviorSubject<string>('');
  suggestOpen = false;
  suggestIndex = -1;
  draft = '';
  composeTarget: SuggestItem | null = null;

  // Members Panel
  showMembers = false;

  // Channel Info Modal
  channelInfoOpen = false;
  channelNameEdit = false;
  channelDescEdit = false;
  editChannelName = '';
  editChannelDesc = '';
  channelTopic = '';
  channelNameError = '';

  // Members Modal
  membersModalOpen = false;
  membersModalPos = { top: 0, left: 0 };

  // Add Members Modal
  addMembersOpen = false;
  addMembersModalPos = { top: 0, left: 0 };
  addMemberInput = '';
  private addMemberInput$ = new BehaviorSubject<string>('');
  showAddMemberSuggest = false;
  addMemberSelected: UserMini | null = null;

  // User Profile Modal
  userProfileOpen = false;
  userProfileId: string | null = null;
  userProfile: { id: string; name: string; email?: string; avatarUrl: string; status?: string } | null = null;

  // Reaction Hover
  hoveredReaction: { msgId: string; emoji: string } | null = null;

  /**
   * Gets toInput$ observable
   */
  getToInput$(): BehaviorSubject<string> {
    return this.toInput$;
  }

  /**
   * Gets addMemberInput$ observable
   */
  getAddMemberInput$(): BehaviorSubject<string> {
    return this.addMemberInput$;
  }

  /**
   * Gets user name map
   */
  getUserNameMap(): Map<string, string> {
    return this.userNameMap;
  }

  /**
   * Sets user name map
   */
  setUserNameMap(map: Map<string, string>): void {
    this.userNameMap = map;
  }
}
