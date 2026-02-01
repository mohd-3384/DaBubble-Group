import { Injectable } from '@angular/core';
import { ThreadUiStateHelper } from './thread-ui-state.helper';
import { ThreadActionsService } from '../services/thread-actions.service';

/**
 * Helper service for managing emoji pickers in thread
 */
@Injectable()
export class ThreadEmojiHelper {
    constructor(
        private ui: ThreadUiStateHelper,
        private threadActions: ThreadActionsService
    ) { }

    /**
     * Toggles the emoji picker for adding reactions to a message
     * @param ev - The mouse event
     * @param messageId - The message ID to react to
     */
    toggleMessageEmojiPicker(ev: MouseEvent, messageId: string) {
        ev.stopPropagation();

        if (this.ui.messageEmojiForId === messageId) {
            this.ui.messageEmojiForId = null;
            return;
        }

        this.ui.editMenuForId = null;
        this.ui.editEmojiForId = null;

        const btn = ev.currentTarget as HTMLElement;
        const pos = this.ui.calculateEmojiPickerPosition(btn);

        this.ui.messageEmojiForId = messageId;
        this.ui.emojiPopoverPos = pos;

        this.ui.showEmoji = false;
        this.ui.showUsers = false;

        this.ui.hoveredRowId = messageId;
    }

    /**
     * Toggles the emoji picker for editing message text
     * @param ev - The mouse event
     * @param messageId - The message ID being edited
     */
    toggleEditEmojiPicker(ev: MouseEvent, messageId: string) {
        ev.stopPropagation();

        this.ui.showEmoji = false;
        this.ui.showUsers = false;
        this.ui.messageEmojiForId = null;
        this.ui.editMenuForId = null;

        if (this.ui.editEmojiForId === messageId) {
            this.ui.editEmojiForId = null;
            return;
        }

        const btn = ev.currentTarget as HTMLElement;
        const pos = this.ui.calculateEmojiPickerPosition(btn);

        this.ui.editEmojiForId = messageId;
        this.ui.editEmojiPopoverPos = pos;
        this.ui.hoveredRowId = messageId;
    }

    /**
     * Handles emoji selection for editing message text
     * @param e - The emoji selection event
     */
    onEditEmojiSelect(e: any) {
        const emoji = this.threadActions.emojiToString(e?.emoji?.native ?? e?.emoji ?? e);
        if (!emoji) return;

        const base = this.ui.editDraft || '';
        this.ui.editDraft = base + emoji;

        this.ui.editEmojiForId = null;
    }
}
