import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SuggestItem, UserMini, MemberVM } from '../interfaces/allInterfaces.interface';

/**
 * Helper class for managing composer functionality in the chat component.
 * Handles compose mode, suggestions, mentions, and input handling.
 */
@Injectable()
export class ChatComposerHelper {
    /** Current value in the "To" field */
    to = '';

    /** Current message draft */
    draft = '';

    /** Whether suggestion dropdown is open */
    suggestOpen = false;

    /** Currently selected suggestion index */
    suggestIndex = -1;

    /** Compose target (channel or user) */
    composeTarget: any = null;

    /** Subject for add member input */
    addMemberInput$ = new BehaviorSubject<string>('');

    /**
     * Handles input in the "To" field.
     * @param value - New input value
     * @param allSuggestions - All available suggestions
     */
    onToInput(value: string, allSuggestions: SuggestItem[]): void {
        this.to = value;
        this.suggestOpen = true;
        this.suggestIndex = -1;

        const norm = this.normalize(value);

        if (norm.startsWith('#') || norm.startsWith('@')) {
            const query = norm.slice(1);
            const match = allSuggestions.find((s) => this.normalize(s.label).includes(query));
            if (match) {
                this.composeTarget = match;
            }
        }
    }

    /**
     * Handles keydown events in the "To" field.
     * @param ev - Keyboard event
     * @param list - Current suggestion list
     * @returns True if the event was handled
     */
    onToKeydown(ev: KeyboardEvent, list: SuggestItem[] | null | undefined): boolean {
        const arr = list || [];

        if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            this.suggestIndex = Math.min(this.suggestIndex + 1, arr.length - 1);
            return true;
        }

        if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            this.suggestIndex = Math.max(this.suggestIndex - 1, -1);
            return true;
        }

        if (ev.key === 'Enter' && this.suggestIndex >= 0 && this.suggestIndex < arr.length) {
            ev.preventDefault();
            this.pickSuggestion(arr[this.suggestIndex]);
            return true;
        }

        return false;
    }

    /**
     * Handles blur event on "To" field.
     */
    onToBlur(): void {
        setTimeout(() => {
            this.suggestOpen = false;
            this.suggestIndex = -1;
        }, 200);
    }

    /**
     * Picks a suggestion from the dropdown.
     * @param s - The selected suggestion
     */
    pickSuggestion(s: SuggestItem): void {
        this.to = s.label;
        this.suggestOpen = false;
        this.suggestIndex = -1;
        this.composeTarget = s;
    }

    /**
     * Inserts a mention into the draft.
     * @param m - The member to mention
     */
    insertMention(m: MemberVM): void {
        const atText = `@${m.name}`;
        const cursorPos = 0;
        const before = this.draft.substring(0, cursorPos);
        const after = this.draft.substring(cursorPos);

        this.draft = before + atText + ' ' + after;
    }

    /**
     * Handles add member input change.
     * @param value - New input value
     */
    onAddMemberInput(value: string): void {
        this.addMemberInput$.next(value);
    }

    /**
     * Selects a member to add.
     * @param u - The user to add
     */
    selectAddMember(u: UserMini): void {
        // Implementation will be in the component
    }

    /**
     * Normalizes a string for comparison.
     * @param s - String to normalize
     * @returns Normalized string
     */
    private normalize(s: string): string {
        return (s || '').toLowerCase().trim();
    }

    /**
     * Track function for messages.
     */
    trackMsg = (_: number, m: any) => m.id;

    /**
     * Track function for members.
     */
    trackMember = (_: number, m: MemberVM) => m.uid;
}
