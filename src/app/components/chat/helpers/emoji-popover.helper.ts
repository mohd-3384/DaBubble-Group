import { Injectable } from '@angular/core';
import { MessageVm } from '../../../interfaces/allInterfaces.interface';

/**
 * Service for calculating emoji popover positions
 */
@Injectable()
export class EmojiPopoverHelper {
    /**
     * Opens emoji picker for composer with position calculation
     * @param event - Mouse event
     * @param showEmoji - Current state
     * @param emojiContext - Current context
     * @returns Position and state
     */
    openEmojiForComposer(
        event: MouseEvent,
        showEmoji: boolean,
        emojiContext: 'composer' | 'message' | 'edit' | null
    ): {
        composerEmojiPos: { top: number; left: number };
        showEmoji: boolean;
        emojiContext: 'composer' | 'message' | 'edit' | null;
        emojiMessageTarget: MessageVm | null;
    } {
        event.stopPropagation();

        if (showEmoji && emojiContext === 'composer') {
            return {
                composerEmojiPos: { top: 0, left: 0 },
                showEmoji: false,
                emojiContext: null,
                emojiMessageTarget: null,
            };
        }

        const pos = this.calculateComposerPosition(event);

        return {
            composerEmojiPos: pos,
            showEmoji: true,
            emojiContext: 'composer',
            emojiMessageTarget: null,
        };
    }

    /**
     * Opens emoji picker for edit mode
     * @param event - Mouse event
     * @param showEmoji - Current state
     * @param emojiContext - Current context
     * @returns Position and state
     */
    openEmojiForEdit(
        event: MouseEvent,
        showEmoji: boolean,
        emojiContext: 'composer' | 'message' | 'edit' | null
    ): {
        composerEmojiPos: { top: number; left: number };
        showEmoji: boolean;
        emojiContext: 'composer' | 'message' | 'edit' | null;
        emojiMessageTarget: MessageVm | null;
    } {
        event.stopPropagation();

        if (showEmoji && emojiContext === 'edit') {
            return {
                composerEmojiPos: { top: 0, left: 0 },
                showEmoji: false,
                emojiContext: null,
                emojiMessageTarget: null,
            };
        }

        const pos = this.calculateComposerPosition(event);

        return {
            composerEmojiPos: pos,
            showEmoji: true,
            emojiContext: 'edit',
            emojiMessageTarget: null,
        };
    }

    /**
     * Toggles emoji picker for message reactions
     * @param event - Mouse event
     * @param msg - Target message
     * @param messageEmojiForId - Current message ID
     * @param from - Source (actions or reactions)
     * @returns Position and state
     */
    toggleMessageEmojiPicker(
        event: MouseEvent,
        msg: MessageVm,
        messageEmojiForId: string | null,
        from: 'actions' | 'reactions' = 'reactions'
    ): {
        messageEmojiForId: string | null;
        emojiPopoverPos: { top: number; left: number; placement: 'top' | 'bottom' };
        emojiContext: 'composer' | 'message' | 'edit' | null;
        emojiMessageTarget: MessageVm | null;
        emojiOpenedFrom: 'actions' | 'reactions' | null;
    } {
        event.stopPropagation();

        if (messageEmojiForId === msg.id) {
            return this.closeMessagePopover();
        }

        const pos = this.calculateMessagePosition(event);

        return {
            messageEmojiForId: msg.id,
            emojiPopoverPos: pos,
            emojiContext: 'message',
            emojiMessageTarget: msg,
            emojiOpenedFrom: from,
        };
    }

    /**
     * Closes message emoji popover
     * @returns Closed state
     */
    closeMessagePopover(): {
        messageEmojiForId: string | null;
        emojiPopoverPos: { top: number; left: number; placement: 'top' | 'bottom' };
        emojiContext: 'composer' | 'message' | 'edit' | null;
        emojiMessageTarget: MessageVm | null;
        emojiOpenedFrom: 'actions' | 'reactions' | null;
    } {
        return {
            messageEmojiForId: null,
            emojiPopoverPos: { top: 0, left: 0, placement: 'bottom' },
            emojiContext: null,
            emojiMessageTarget: null,
            emojiOpenedFrom: null,
        };
    }

    /**
     * Calculates position for composer/edit emoji picker
     * @param event - Mouse event
     * @returns Position object
     */
    private calculateComposerPosition(event: MouseEvent): { top: number; left: number } {
        const btn = event.currentTarget as HTMLElement;
        const rect = btn.getBoundingClientRect();

        const viewportH = this.getViewportHeight();
        const viewportW = this.getViewportWidth();

        const pickerWidth = 360;
        const estimatedHeight = 360;
        const offset = 10;

        let left = Math.max(10, Math.min(rect.left, viewportW - pickerWidth - 10));
        let top = rect.top - estimatedHeight - offset;

        return { top, left };
    }

    /**
     * Calculates position for message emoji picker
     * @param event - Mouse event
     * @returns Position object with placement
     */
    private calculateMessagePosition(
        event: MouseEvent
    ): { top: number; left: number; placement: 'top' | 'bottom' } {
        const btn = event.currentTarget as HTMLElement;
        const rect = btn.getBoundingClientRect();

        const viewportH = this.getViewportHeight();
        const viewportW = this.getViewportWidth();

        const pickerHeight = 360;
        const pickerWidth = 360;
        const offset = 8;

        const roomBelow = viewportH - rect.bottom;
        const placement: 'top' | 'bottom' = roomBelow > pickerHeight + offset ? 'bottom' : 'top';

        let top = placement === 'bottom'
            ? rect.bottom + offset
            : rect.top - pickerHeight - offset;

        let left = rect.left;
        const maxLeft = viewportW - pickerWidth - 16;
        if (left > maxLeft) left = Math.max(16, maxLeft);

        return { top, left, placement };
    }

    /**
     * Gets viewport height
     * @returns Viewport height
     */
    private getViewportHeight(): number {
        return window.innerHeight || document.documentElement.clientHeight;
    }

    /**
     * Gets viewport width
     * @returns Viewport width
     */
    private getViewportWidth(): number {
        return window.innerWidth || document.documentElement.clientWidth;
    }
}
