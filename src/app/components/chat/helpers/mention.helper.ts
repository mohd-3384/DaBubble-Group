import { Injectable } from '@angular/core';
import { MemberVM } from '../../../interfaces/allInterfaces.interface';

/**
 * Service for mention functionality
 */
@Injectable()
export class MentionHelper {
    /**
     * Inserts a mention into draft
     * @param member - Member to mention
     * @param draft - Current draft text
     * @returns Updated draft
     */
    insertMention(member: MemberVM, draft: string): string {
        const name = member.name ?? 'Member';
        const mention = `@${name}`;

        const base = draft || '';
        const needsSpace = base.length > 0 && !/\s$/.test(base);

        return base + (needsSpace ? ' ' : '') + mention + ' ';
    }

    /**
     * Toggles members panel
     * @param showMembers - Current state
     * @param showEmoji - Emoji state
     * @param composeMode - Is compose mode
     * @returns New state
     */
    toggleMembers(
        showMembers: boolean,
        showEmoji: boolean,
        composeMode: boolean
    ): {
        showMembers: boolean;
        showEmoji: boolean;
        shouldOpenCompose: boolean;
    } {
        if (composeMode) {
            return {
                showMembers,
                showEmoji,
                shouldOpenCompose: true,
            };
        }

        const next = !showMembers;
        return {
            showMembers: next,
            showEmoji: next ? false : showEmoji,
            shouldOpenCompose: false,
        };
    }

    /**
     * Closes members panel
     * @returns New state
     */
    closeMembers(): boolean {
        return false;
    }
}
