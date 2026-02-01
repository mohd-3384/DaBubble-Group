import { Injectable } from '@angular/core';
import { MentionUser } from '../../../interfaces/allInterfaces.interface';

/**
 * Helper service for managing mentions and draft text in thread composer
 */
@Injectable()
export class ThreadComposerHelper {
  draft = '';

  /**
   * Inserts a user mention into the draft
   * @param user - The user to mention
   */
  insertMention(user: MentionUser) {
    const mention = `@${user.name}`;
    const base = this.draft || '';
    const needsSpace = base.length > 0 && !/\s$/.test(base);
    this.draft = base + (needsSpace ? ' ' : '') + mention + ' ';
  }

  /**
   * Adds an emoji to the draft
   * @param emoji - The emoji string to add
   */
  addEmoji(emoji: string) {
    const base = this.draft || '';
    this.draft = base + emoji;
  }

  /**
   * Gets the trimmed draft text
   * @returns Trimmed draft or empty string
   */
  getTrimmedDraft(): string {
    return (this.draft || '').trim();
  }

  /**
   * Clears the draft
   */
  clearDraft() {
    this.draft = '';
  }
}
