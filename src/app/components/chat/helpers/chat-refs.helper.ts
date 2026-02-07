import { Injectable, ElementRef } from '@angular/core';

/**
 * Manages ViewChild references for chat component
 * Centralizes template reference management
 */
@Injectable()
export class ChatRefsHelper {
    toInputEl?: ElementRef<HTMLInputElement>;
    composerInputEl?: ElementRef<HTMLTextAreaElement>;
    membersBtn?: ElementRef<HTMLElement>;
    addMembersBtn?: ElementRef<HTMLElement>;
    msgEmojiPopover?: ElementRef<HTMLElement>;

    /**
     * Sets toInputEl reference
     */
    setToInputEl(el: ElementRef<HTMLInputElement> | undefined): void {
        this.toInputEl = el;
    }

    /**
     * Sets composerInputEl reference
     */
    setComposerInputEl(el: ElementRef<HTMLTextAreaElement> | undefined): void {
        this.composerInputEl = el;
    }

    /**
     * Sets membersBtn reference
     */
    setMembersBtn(el: ElementRef<HTMLElement> | undefined): void {
        this.membersBtn = el;
    }

    /**
     * Sets addMembersBtn reference
     */
    setAddMembersBtn(el: ElementRef<HTMLElement> | undefined): void {
        this.addMembersBtn = el;
    }

    /**
     * Sets msgEmojiPopover reference
     */
    setMsgEmojiPopover(el: ElementRef<HTMLElement> | undefined): void {
        this.msgEmojiPopover = el;
    }
}
