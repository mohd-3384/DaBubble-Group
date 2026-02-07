import { Injectable } from '@angular/core';
import { isOwnMessage } from './message.utils';

/**
 * Service for edit menu management
 */
@Injectable()
export class EditMenuHelper {
    /**
     * Toggles edit menu for a message
     * @param event - Mouse event
     * @param message - Message object
     * @param editMenuForId - Current edit menu message ID
     * @param editingMessageId - Currently editing message ID
     * @param currentUserId - Current user ID
     * @returns New state or null if closed
     */
    toggleEditMenu(
        event: MouseEvent,
        message: any,
        editMenuForId: string | null,
        editingMessageId: string | null,
        currentUserId: string | null
    ): { editMenuForId: string; editMenuPos: { top: number; left: number } } | null {
        event.stopPropagation();

        if (!isOwnMessage(message, currentUserId)) return null;
        if (editingMessageId === message.id) return null;

        if (editMenuForId === message.id) {
            return null;
        }

        const pos = this.calculatePosition(event);

        return {
            editMenuForId: message.id,
            editMenuPos: pos,
        };
    }

    /**
     * Calculates edit menu position with viewport handling
     * @param event - Mouse event
     * @returns Position object
     */
    private calculatePosition(event: MouseEvent): { top: number; left: number } {
        const btn = event.currentTarget as HTMLElement;
        const rect = btn.getBoundingClientRect();

        const popW = 320;
        const offset = 8;

        const viewportW = this.getViewportWidth();
        const viewportH = this.getViewportHeight();

        let top = rect.bottom + offset - 4;
        let left = rect.left;

        left = Math.min(left, viewportW - popW - 16);
        left = Math.max(16, left);

        const estimatedH = 70;
        if (top + estimatedH > viewportH - 10) {
            top = rect.top - estimatedH - offset;
            top = Math.max(10, top);
        }

        return { top, left };
    }

    /**
     * Gets viewport width
     * @returns Viewport width
     */
    private getViewportWidth(): number {
        return window.innerWidth || document.documentElement.clientWidth;
    }

    /**
     * Gets viewport height
     * @returns Viewport height
     */
    private getViewportHeight(): number {
        return window.innerHeight || document.documentElement.clientHeight;
    }
}
