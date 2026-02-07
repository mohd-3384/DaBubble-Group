import { Injectable, inject } from '@angular/core';
import { ChatStateHelper } from './chat-state.helper';
import { EmojiHelper } from './emoji.helper';
import { EmojiPopoverHelper } from './emoji-popover.helper';
import { ChatRefsHelper } from './chat-refs.helper';
import { UiStateHelper } from './ui-state.helper';
import { MessageVm } from '../../../interfaces/allInterfaces.interface';
import { ReactionHelper } from './reaction.helper';

/**
 * Helper for coordinating emoji operations
 */
@Injectable()
export class EmojiCoordinatorHelper {
  private state = inject(ChatStateHelper);
  private emoji = inject(EmojiHelper);
  private emojiPopover = inject(EmojiPopoverHelper);
  private refs = inject(ChatRefsHelper);
  private reaction = inject(ReactionHelper);
  private uiState = inject(UiStateHelper);

  /**
   * Toggles emoji picker
   * @param evt - Optional event
   */
  toggleEmoji(evt?: Event): void {
    evt?.stopPropagation();
    const result = this.emoji.toggleEmoji(this.state.showEmoji, this.state.showMembers);
    this.state.showEmoji = result.showEmoji;
    this.state.showMembers = result.showMembers;
  }

  /**
   * Closes emoji picker
   */
  closeEmoji(): void {
    this.state.showEmoji = this.emoji.closeEmoji();
  }

  /**
   * Handles emoji selection
   * @param e - Emoji event
   */
  async onEmojiSelect(e: any): Promise<void> {
    const result = this.emoji.onEmojiSelect(
      e,
      this.state.emojiContext,
      this.state.draft,
      this.state.editDraft,
      this.state.emojiMessageTarget
    );
    if (result.shouldAddReaction && this.state.emojiMessageTarget) {
      await this.reaction.addReaction(this.state.emojiMessageTarget, result.emoji, this.state.currentUser);
      this.state.messageEmojiForId = null;
      this.state.emojiContext = null;
      this.state.emojiMessageTarget = null;
      return;
    }
    this.state.draft = result.draft;
    this.state.editDraft = result.editDraft;
    if (result.shouldClose) {
      this.closeEmoji();
      this.state.emojiContext = null;
    }
  }

  /**
   * Opens emoji for composer
   * @param ev - Mouse event
   */
  openEmojiForComposer(ev: MouseEvent): void {
    const result = this.emojiPopover.openEmojiForComposer(ev, this.state.showEmoji, this.state.emojiContext);
    this.state.composerEmojiPos = result.composerEmojiPos;
    this.state.showEmoji = result.showEmoji;
    this.state.emojiContext = result.emojiContext;
    this.state.emojiMessageTarget = result.emojiMessageTarget;
    this.state.showMembers = false;
  }

  /**
   * Opens emoji for edit
   * @param ev - Mouse event
   */
  openEmojiForEdit(ev: MouseEvent): void {
    const result = this.emojiPopover.openEmojiForEdit(ev, this.state.showEmoji, this.state.emojiContext);
    this.state.composerEmojiPos = result.composerEmojiPos;
    this.state.showEmoji = result.showEmoji;
    this.state.emojiContext = result.emojiContext;
    this.state.emojiMessageTarget = result.emojiMessageTarget;
    this.state.showMembers = false;
    this.state.messageEmojiForId = null;
  }

  /**
   * Toggles message emoji picker
   * @param ev - Mouse event
   * @param msg - Message
   * @param from - Source
   */
  toggleMessageEmojiPicker(ev: MouseEvent, msg: MessageVm, from: 'actions' | 'reactions' = 'reactions'): void {
    const result = this.emojiPopover.toggleMessageEmojiPicker(ev, msg, this.state.messageEmojiForId, from);
    this.state.messageEmojiForId = result.messageEmojiForId;
    this.state.emojiPopoverPos = result.emojiPopoverPos;
    this.state.emojiContext = result.emojiContext;
    this.state.emojiMessageTarget = result.emojiMessageTarget;
    this.state.emojiOpenedFrom = result.emojiOpenedFrom;
  }

  /**
   * Closes message emoji popover
   */
  closeMessageEmojiPopover(): void {
    const result = this.emojiPopover.closeMessagePopover();
    this.state.messageEmojiForId = result.messageEmojiForId;
    this.state.emojiPopoverPos = result.emojiPopoverPos;
    this.state.emojiContext = result.emojiContext;
    this.state.emojiMessageTarget = result.emojiMessageTarget;
    this.state.emojiOpenedFrom = result.emojiOpenedFrom;
  }

  /**
   * Handles emoji click event
   * @param event - Emoji event
   */
  onEmojiClick(event: any): void {
    const emoji = event?.detail?.unicode || event?.detail?.emoji?.unicode || '';
    this.state.draft += emoji;
  }

  /**
   * Handles document click for emoji popover
   * @param ev - Mouse event
   * @returns True if should close
   */
  shouldCloseOnDocumentClick(ev: MouseEvent): boolean {
    return this.uiState.onDocumentClick(
      ev,
      this.state.messageEmojiForId,
      this.refs.msgEmojiPopover?.nativeElement
    );
  }

  /**
   * Checks if should close on scroll/touch
   * @returns True if emoji is open
   */
  shouldCloseOnScrollOrTouch(): boolean {
    return !!this.state.messageEmojiForId;
  }
}
