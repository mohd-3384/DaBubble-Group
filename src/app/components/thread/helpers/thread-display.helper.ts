import { Injectable } from '@angular/core';
import { Message, MentionUser } from '../../../interfaces/allInterfaces.interface';

/**
 * Helper service for thread display functions (user data, reactions, formatting)
 */
@Injectable()
export class ThreadDisplayHelper {
  /**
   * Gets the display name for a user ID
   * @param uid - Optional user ID
   * @param users - List of all users
   * @returns User name or 'Unbekannt' if not found
   */
  getUserName(uid: string | null | undefined, users: MentionUser[]): string {
    if (!uid) return 'Unbekannt';
    return users.find(u => u.id === uid)?.name ?? 'Unbekannt';
  }

  /**
   * Gets the avatar URL for a user ID
   * @param uid - Optional user ID
   * @param users - List of all users
   * @returns Avatar URL or default avatar if not found
   */
  getUserAvatar(uid: string | null | undefined, users: MentionUser[]): string {
    if (!uid) return '/public/images/avatars/avatar-default.svg';
    return users.find(u => u.id === uid)?.avatarUrl ?? '/public/images/avatars/avatar-default.svg';
  }

  /**
   * Gets formatted user names for a reaction tooltip
   * @param m - The message
   * @param emoji - The emoji
   * @param users - List of all users
   * @param currentUserId - Current user ID
   * @returns Array of user names (including 'Du' for current user)
   */
  getReactionNames(m: Message, emoji: string, users: MentionUser[], currentUserId: string | null): string[] {
    const by = ((m as any)?.reactionBy?.[emoji] || {}) as Record<string, any>;
    const myUid = currentUserId ?? '';

    const names = Object.keys(by)
      .filter((uid) => !!by[uid])
      .map((uid) => {
        if (myUid && uid === myUid) return 'Du';
        return users.find((u) => u.id === uid)?.name ?? 'Unbekannt';
      });

    return names.length ? names : ['Unbekannt'];
  }

  /**
   * Gets the appropriate German verb for reaction tooltip
   * @param m - The message
   * @param emoji - The emoji
   * @param users - List of all users
   * @param currentUserId - Current user ID
   * @returns Verb string ('hast reagiert', 'hat reagiert', or 'haben reagiert')
   */
  getReactionVerb(m: Message, emoji: string, users: MentionUser[], currentUserId: string | null): string {
    const names = this.getReactionNames(m, emoji, users, currentUserId);
    const includesYou = names.includes('Du');

    if (includesYou && names.length === 1) return 'hast reagiert';
    return names.length === 1 ? 'hat reagiert' : 'haben reagiert';
  }

  /**
   * Gets the names of users who reacted with a specific emoji
   * @param m - The message
   * @param emoji - The emoji to check
   * @param users - List of all users
   * @returns Array of user names
   */
  getReactedUserNames(m: Message, emoji: string, users: MentionUser[]): string[] {
    const by = ((m as any)?.reactionBy?.[emoji] ?? {}) as Record<string, boolean>;
    const ids = Object.keys(by).filter((uid) => by[uid]);
    return ids.map((uid) => users.find((u) => u.id === uid)?.name ?? uid);
  }
}
