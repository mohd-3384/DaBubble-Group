import { Injectable } from '@angular/core';
import { Message } from '../interfaces/allInterfaces.interface';
import { ThreadUiStateHelper } from './thread-ui-state.helper';

/**
 * Helper service for managing hover states in thread
 */
@Injectable()
export class ThreadHoverHelper {
    constructor(private ui: ThreadUiStateHelper) { }

    /**
     * Handles mouse enter on a message row
     * @param id - The message ID
     */
    onRowEnter(id: string) {
        if (this.ui.leaveTimer) clearTimeout(this.ui.leaveTimer);
        this.ui.leaveTimer = null;
        this.ui.hoveredRowId = id;
    }

    /**
     * Handles mouse leave on a message row
     * @param id - The message ID
     */
    onRowLeave(id: string) {
        if (this.ui.leaveTimer) clearTimeout(this.ui.leaveTimer);
        if (this.ui.hoveredRowId === id) this.ui.hoveredRowId = null;

        this.ui.leaveTimer = setTimeout(() => {
            const popoverOpen = this.ui.editMenuForId === id || this.ui.messageEmojiForId === id;
            const hoverPopover = this.ui.popoverHoverForId === id;

            if (popoverOpen || hoverPopover) return;

            if (this.ui.editMenuForId === id) this.ui.editMenuForId = null;
            if (this.ui.messageEmojiForId === id) this.ui.messageEmojiForId = null;
        }, 100);
    }

    /**
     * Handles mouse enter on a popover element
     * @param id - The message ID
     */
    onPopoverEnter(id: string) {
        if (this.ui.leaveTimer) clearTimeout(this.ui.leaveTimer);
        this.ui.leaveTimer = null;
        this.ui.popoverHoverForId = id;
        this.ui.hoveredRowId = id;
    }

    /**
     * Handles mouse leave on a popover element
     * @param id - The message ID
     */
    onPopoverLeave(id: string) {
        if (this.ui.popoverHoverForId === id) this.ui.popoverHoverForId = null;
        this.onRowLeave(id);
    }

    /**
     * Handles hovering over a reaction chip
     * @param m - The message (null to clear hover)
     * @param emoji - Optional emoji being hovered
     */
    onReactionHover(m: Message | null, emoji?: string) {
        if (!m || !emoji) {
            this.ui.hoveredReaction = null;
            return;
        }
        this.ui.hoveredReaction = { msgId: m.id, emoji };
    }

    /**
     * Checks if a specific reaction is currently hovered
     * @param m - The message
     * @param emoji - The emoji
     * @returns True if this reaction is hovered
     */
    isReactionHovered(m: Message, emoji: string): boolean {
        return !!this.ui.hoveredReaction
            && this.ui.hoveredReaction.msgId === m.id
            && this.ui.hoveredReaction.emoji === emoji;
    }
}
