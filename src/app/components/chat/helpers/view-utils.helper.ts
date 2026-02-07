import { Injectable } from '@angular/core';
import { MemberVM, MessageVm } from '../../../interfaces/allInterfaces.interface';

/**
 * Helper for view utilities and trackBy functions
 */
@Injectable()
export class ViewUtilsHelper {
    /**
     * TrackBy function for messages
     * @param _index - Index (unused)
     * @param m - Message
     * @returns Message ID
     */
    trackMsg(_index: number, m: MessageVm): string {
        return m.id;
    }

    /**
     * TrackBy function for members
     * @param _index - Index (unused)
     * @param m - Member
     * @returns Member UID
     */
    trackMember(_index: number, m: MemberVM): string {
        return m.uid;
    }

    /**
     * TrackBy function for reactions
     * @param _index - Index (unused)
     * @param r - Reaction object
     * @returns Emoji string
     */
    trackReaction(_index: number, r: { emoji: string; count: number }): string {
        return r.emoji;
    }

    /**
     * TrackBy function for day groups
     * @param _index - Index (unused)
     * @param group - Day group
     * @returns Day label
     */
    trackDayGroup(_index: number, group: any): string {
        return group.day;
    }

    /**
     * TrackBy function for suggestions
     * @param _index - Index (unused)
     * @param item - Suggestion item
     * @returns Item ID
     */
    trackSuggestion(_index: number, item: any): string {
        return item.id || item.uid || item.name;
    }

    /**
     * Returns configuration for emoji-mart
     * @returns Emoji picker config
     */
    getEmojiMartConfig(): any {
        return {
            showPreview: false,
            showSkinTones: false,
            autoFocus: true,
        };
    }
}
