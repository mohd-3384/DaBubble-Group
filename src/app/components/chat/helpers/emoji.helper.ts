import { Injectable } from '@angular/core';
import { MessageVm } from '../../../interfaces/allInterfaces.interface';

/**
 * Service for emoji picker management
 */
@Injectable()
export class EmojiHelper {
    /**
     * Toggles emoji picker visibility
     * @param showEmoji - Current state
     * @param showMembers - Members panel state
     * @returns New state tuple
     */
    toggleEmoji(showEmoji: boolean, showMembers: boolean): { showEmoji: boolean; showMembers: boolean } {
        return {
            showEmoji: !showEmoji,
            showMembers: showEmoji ? showMembers : false,
        };
    }

    /**
     * Closes emoji picker
     * @returns New state
     */
    closeEmoji(): boolean {
        return false;
    }

    /**
     * Handles emoji selection for different contexts
     * @param event - Emoji event
     * @param context - Context (composer/message/edit)
     * @param draft - Current draft text
     * @param editDraft - Current edit draft
     * @param messageTarget - Target message for reactions
     * @returns Updated state
     */
    onEmojiSelect(
        event: any,
        context: 'composer' | 'message' | 'edit' | null,
        draft: string,
        editDraft: string,
        messageTarget: MessageVm | null
    ): {
        draft: string;
        editDraft: string;
        shouldClose: boolean;
        shouldAddReaction: boolean;
        emoji: string;
    } {
        const emoji = this.emojiToString(event);

        if (context === 'message' && messageTarget) {
            return {
                draft,
                editDraft,
                shouldClose: false,
                shouldAddReaction: true,
                emoji,
            };
        }

        if (context === 'edit') {
            return {
                draft,
                editDraft: (editDraft || '') + emoji,
                shouldClose: true,
                shouldAddReaction: false,
                emoji,
            };
        }

        return {
            draft: draft + emoji,
            editDraft,
            shouldClose: true,
            shouldAddReaction: false,
            emoji,
        };
    }

    /**
     * Converts emoji event to string
     * @param e - Emoji event
     * @returns Emoji string
     */
    emojiToString(e: any): string {
        return (
            e?.emoji?.native ??
            e?.emoji?.char ??
            e?.native ??
            e?.colons ??
            ''
        );
    }
}
