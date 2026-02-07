import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Service for UI state management
 */
@Injectable()
export class UiStateHelper {
    private platformId = inject(PLATFORM_ID);

    /**
     * Closes all popovers and menus
     * @returns Closed state
     */
    closeAllPopovers(): {
        showEmoji: boolean;
        showMembers: boolean;
        messageEmojiForId: string | null;
        editMenuForId: string | null;
    } {
        return {
            showEmoji: false,
            showMembers: false,
            messageEmojiForId: null,
            editMenuForId: null,
        };
    }

    /**
     * Handles message row leave event
     * @param messageId - Message ID
     * @param editMenuForId - Current edit menu ID
     * @param messageEmojiForId - Current emoji popover ID
     * @param emojiOpenedFrom - Emoji source
     * @returns Updated state
     */
    onMessageRowLeave(
        messageId: string,
        editMenuForId: string | null,
        messageEmojiForId: string | null,
        emojiOpenedFrom: 'actions' | 'reactions' | null
    ): {
        editMenuForId: string | null;
        messageEmojiForId: string | null;
    } {
        const newEditMenu = editMenuForId === messageId ? null : editMenuForId;

        const newEmojiFor =
            messageEmojiForId === messageId && emojiOpenedFrom === 'actions'
                ? null
                : messageEmojiForId;

        return {
            editMenuForId: newEditMenu,
            messageEmojiForId: newEmojiFor,
        };
    }

    /**
     * Handles message row leave but keeps emoji open
     * @param messageId - Message ID
     * @param editMenuForId - Current edit menu ID
     * @returns Updated state
     */
    onMessageRowLeaveKeepEmoji(
        messageId: string,
        editMenuForId: string | null
    ): { editMenuForId: string | null } {
        return {
            editMenuForId: editMenuForId === messageId ? null : editMenuForId,
        };
    }

    /**
     * Handles document click for closing popovers
     * @param event - Mouse event
     * @param messageEmojiForId - Current emoji popover ID
     * @param msgEmojiPopover - Emoji popover element
     * @returns Should close emoji
     */
    onDocumentClick(
        event: MouseEvent,
        messageEmojiForId: string | null,
        msgEmojiPopover?: HTMLElement
    ): boolean {
        if (!messageEmojiForId) return false;

        const target = event.target as Node;

        if (msgEmojiPopover && msgEmojiPopover.contains(target)) {
            return false;
        }

        return true;
    }

    /**
     * Locks or unlocks body scroll
     * @param locked - Lock state
     */
    lockBodyScroll(locked: boolean): void {
        if (!isPlatformBrowser(this.platformId)) return;
        document.body.style.overflow = locked ? 'hidden' : '';
    }
}
