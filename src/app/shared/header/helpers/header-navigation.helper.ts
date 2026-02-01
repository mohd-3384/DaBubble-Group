import { inject, Injectable } from '@angular/core';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';

/**
 * Helper service for managing header navigation state
 * Handles route-based UI state changes (chat open, new message, etc.)
 */
@Injectable({ providedIn: 'root' })
export class HeaderNavigationHelper {
    private router = inject(Router);

    /**
     * Extracts the URL from a router event
     * @param event - NavigationEnd or NavigationStart event
     * @returns The URL string
     */
    getEventUrl(event: NavigationEnd | NavigationStart): string {
        return event instanceof NavigationEnd
            ? (event.urlAfterRedirects || event.url)
            : event.url;
    }

    /**
     * Checks if the URL represents a chat route
     * @param url - The URL to check
     * @returns True if URL is a chat route
     */
    isChatRoute(url: string): boolean {
        return url.startsWith('/channel/') || url.startsWith('/dm/') || url.startsWith('/new');
    }

    /**
     * Checks if the URL represents the new message route
     * @param url - The URL to check
     * @returns True if URL is the new message route
     */
    isNewMessageRoute(url: string): boolean {
        return url.startsWith('/new');
    }

    /**
     * Extracts the channel ID from a URL if present
     * @param url - The URL to parse
     * @returns Channel ID or null
     */
    extractChannelId(url: string): string | null {
        const channelMatch = url.match(/\/channel\/([^/]+)/);
        return channelMatch ? channelMatch[1] : null;
    }

    /**
     * Determines the appropriate back navigation action based on current URL
     * @param currentUrl - The current route URL
     */
    navigateBack(currentUrl: string): void {
        if (this.isThreadRoute(currentUrl)) {
            window.history.back();
            return;
        }

        if (currentUrl.startsWith('/new')) {
            window.history.back();
            return;
        }

        if (currentUrl.startsWith('/channel/') || currentUrl.startsWith('/dm/')) {
            this.router.navigate(['/channels']);
            return;
        }

        this.router.navigate(['/channels']);
    }

    /**
     * Checks if the URL is a thread route
     * @param url - The URL to check
     * @returns True if URL is a thread route
     */
    private isThreadRoute(url: string): boolean {
        return !!url.match(/\/(channel|dm)\/[^/]+\/thread\//);
    }
}
