import { Injectable, inject } from '@angular/core';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';

/**
 * Helper service for shell navigation and mobile view state
 * Handles URL-based view state determination
 */
@Injectable({ providedIn: 'root' })
export class ShellNavigationHelper {
    private router = inject(Router);

    /**
     * Handles router navigation events
     * @param e - Navigation event (NavigationStart or NavigationEnd)
     * @returns URL from the event
     */
    getEventUrl(e: NavigationStart | NavigationEnd): string {
        return e instanceof NavigationEnd
            ? (e.urlAfterRedirects || e.url)
            : e.url;
    }

    /**
     * Determines mobile view state based on URL
     * @param url - Current router URL
     * @returns Mobile view state
     */
    getMobileView(url: string): 'list' | 'chat' | 'thread' {
        if (this.isThreadUrl(url)) {
            return 'thread';
        }

        const isChat = this.isChatUrl(url);
        const isChannelsList = this.isChannelsListUrl(url);
        return isChannelsList ? 'list' : (isChat ? 'chat' : 'list');
    }

    /**
     * Checks if URL is a thread route
     * @param url - URL to check
     * @returns True if URL is a thread route
     */
    isThreadUrl(url: string): boolean {
        return !!url.match(/\/(channel|dm)\/[^/]+\/thread\//i);
    }

    /**
     * Checks if URL is a chat route
     * @param url - URL to check
     * @returns True if URL is a chat route
     */
    isChatUrl(url: string): boolean {
        return url.startsWith('/channel/') || url.startsWith('/dm/') || url.startsWith('/new');
    }

    /**
     * Checks if URL is the channels list route
     * @param url - URL to check
     * @returns True if URL is channels list
     */
    isChannelsListUrl(url: string): boolean {
        return url === '/channels' || url === '/channels/';
    }
}
