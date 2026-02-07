/**
 * Message utility functions
 */

/**
 * Checks if a message is owned by the current user
 * @param message - Message object
 * @param currentUserId - Current user ID
 * @returns True if message is owned by user
 */
export function isOwnMessage(
    message: { authorId?: string } | null | undefined,
    currentUserId: string | null | undefined
): boolean {
    return !!currentUserId && String(message?.authorId ?? '') === String(currentUserId);
}

/**
 * Fixes avatar URL to ensure proper path
 * @param url - Avatar URL
 * @returns Fixed avatar URL
 */
export function fixAvatar(url?: string): string {
    if (!url) return '/public/images/avatars/avatar-default.svg';
    return url.startsWith('/') ? url : '/' + url;
}

/**
 * Normalizes a string for comparison
 * @param s - String to normalize
 * @returns Normalized string
 */
export function normalize(s: string): string {
    return (s || '').toLowerCase().trim();
}
