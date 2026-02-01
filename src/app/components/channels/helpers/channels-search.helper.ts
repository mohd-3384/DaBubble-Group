import { Injectable, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, from, Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { collection, collectionData, Firestore, getDocs, limit, orderBy, query } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { WsChannelResult, WsSearchResult } from '../../../interfaces/allInterfaces.interface';

/**
 * Helper service for workspace search functionality.
 * Manages search state, performs searches across channels/users/messages,
 * and handles keyboard navigation in search results.
 */
@Injectable()
export class ChannelsSearchHelper {
  /** Search input element reference */
  wsSearchInput?: ElementRef<HTMLInputElement>;

  /** Search term subject for reactive updates */
  private wsSearch$ = new BehaviorSubject<string>('');

  /** Search dropdown visibility state */
  wsSearchOpen = false;

  /** Active keyboard navigation index */
  wsActiveIndex = -1;

  /** Cached latest search results for keyboard navigation */
  private wsLatestResults: WsSearchResult[] = [];

  /** Current search term display value */
  wsSearchTerm = '';

  /** Observable of combined search results */
  wsResults$: Observable<WsSearchResult[]>;

  constructor(
    private fs: Firestore,
    private auth: Auth,
    private router: Router
  ) {
    this.wsResults$ = this.initializeSearchResults();
  }

  /**
   * Initializes the search results observable.
   * Combines auth state and search term to perform reactive searches.
   */
  private initializeSearchResults(): Observable<WsSearchResult[]> {
    return combineLatest([
      authState(this.auth),
      this.wsSearch$.pipe(debounceTime(120), distinctUntilChanged()),
    ]).pipe(
      switchMap(([u, term]) => this.performSearch(u, term)),
      startWith([] as WsSearchResult[]),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  /**
   * Updates the workspace search term and opens the search results.
   * @param v - The search term string
   */
  setWsSearch(v: string): void {
    this.wsSearchTerm = v;
    const term = (v || '').trim().toLowerCase();
    this.wsSearchOpen = !!term;
    this.wsActiveIndex = -1;
    this.wsSearch$.next(term);
  }

  /**
   * Opens the workspace search dropdown if there is a search term.
   */
  openWsSearch(): void {
    const t = this.wsSearch$.value;
    this.wsSearchOpen = !!t;
  }

  /**
   * Clears the workspace search and resets the search state.
   * Refocuses the search input field.
   */
  clearWsSearch(): void {
    this.wsSearchTerm = '';
    this.wsSearch$.next('');
    this.wsSearchOpen = false;
    this.wsActiveIndex = -1;
    queueMicrotask(() => this.wsSearchInput?.nativeElement?.focus());
  }

  /**
   * Closes the workspace search dropdown.
   */
  closeWsSearch(): void {
    this.wsSearchOpen = false;
    this.wsActiveIndex = -1;
  }

  /**
   * Performs a comprehensive search across channels, users, and messages.
   * Returns empty results if user is not authenticated or no search term provided.
   * @param u - The authenticated user (from Firebase authState)
   * @param term - The search term to look for
   * @returns Observable of combined search results from all sources
   */
  private performSearch(u: any, term: string): Observable<WsSearchResult[]> {
    if (!u || !term) {
      this.wsLatestResults = [];
      return of([] as WsSearchResult[]);
    }

    const channels$ = this.searchChannels(term);
    const users$ = this.searchUsers(term);
    const messages$ = from(this.searchChannelMessages(term)).pipe(
      catchError(() => of([] as WsSearchResult[]))
    );

    return this.combineSearchResults(channels$, users$, messages$);
  }

  /**
   * Searches through all channels for names matching the term.
   * Returns up to 6 matching channels.
   * @param term - The search term (case-insensitive)
   * @returns Observable of matching channel results
   */
  private searchChannels(term: string): Observable<WsChannelResult[]> {
    return collectionData(collection(this.fs, 'channels'), { idField: 'id' }).pipe(
      map((rows: any[]) =>
        (rows || [])
          .map((c): WsChannelResult => ({
            kind: 'channel',
            id: String(c.id),
            name: String(c?.name ?? c.id),
          }))
          .filter((c) => c.name.toLowerCase().includes(term))
          .slice(0, 6)
      ),
      catchError(() => of([] as WsChannelResult[]))
    );
  }

  /**
   * Searches through all users for names matching the term.
   * Returns up to 6 matching users.
   * @param term - The search term (case-insensitive)
   * @returns Observable of matching user results
   */
  private searchUsers(term: string): Observable<WsSearchResult[]> {
    return collectionData(collection(this.fs, 'users'), { idField: 'id' }).pipe(
      map((rows: any[]) =>
        (rows || [])
          .filter((x) => String(x?.name ?? '').toLowerCase().includes(term))
          .slice(0, 6)
          .map((x) => ({
            kind: 'user',
            id: String(x.id),
            name: String(x.name ?? 'Unbekannt'),
            avatarUrl: (x.avatarUrl as string | undefined),
          }) as WsSearchResult)
      ),
      catchError(() => of([] as WsSearchResult[]))
    );
  }

  /**
   * Combines search results from channels, users, and messages into a single list.
   * Limits total results to 10 items and updates the latest results cache.
   * @param channels$ - Observable of channel search results
   * @param users$ - Observable of user search results
   * @param messages$ - Observable of message search results
   * @returns Observable of merged and limited search results (max 10)
   */
  private combineSearchResults(
    channels$: Observable<WsChannelResult[]>,
    users$: Observable<WsSearchResult[]>,
    messages$: Observable<WsSearchResult[]>
  ): Observable<WsSearchResult[]> {
    return combineLatest([channels$, users$, messages$]).pipe(
      map(([c, uu, m]) => {
        const merged = [...c, ...uu, ...m].slice(0, 10);
        this.wsLatestResults = merged;
        return merged;
      }),
      catchError(() => of([] as WsSearchResult[]))
    );
  }

  /**
   * Searches through channel messages for the given term.
   * Searches up to 40 recent messages in up to 20 channels.
   * @param term - The search term to look for in messages
   * @returns Promise resolving to an array of message search results (max 10)
   */
  private async searchChannelMessages(term: string): Promise<WsSearchResult[]> {
    try {
      const channelIds = await this.getChannelIds();
      return await this.searchMessagesInChannels(channelIds, term);
    } catch {
      return [];
    }
  }

  /**
   * Fetches up to 20 channel IDs from Firestore.
   * @returns Promise resolving to an array of channel IDs
   */
  private async getChannelIds(): Promise<string[]> {
    const chSnap = await getDocs(query(collection(this.fs, 'channels'), limit(20)));
    return chSnap.docs.map((d) => d.id);
  }

  /**
   * Iterates through channels and searches their messages for the term.
   * @param channelIds - Array of channel IDs to search in
   * @param term - The search term
   * @returns Promise resolving to matching message results (max 10)
   */
  private async searchMessagesInChannels(channelIds: string[], term: string): Promise<WsSearchResult[]> {
    const hits: WsSearchResult[] = [];
    const t = term.toLowerCase();

    for (const channelId of channelIds) {
      if (hits.length >= 10) break;
      await this.searchMessagesInChannel(channelId, t, hits);
    }

    return hits.slice(0, 10);
  }

  /**
   * Searches messages in a specific channel for the given term.
   * Fetches up to 40 recent messages and adds matches to hits array.
   * @param channelId - The channel ID to search in
   * @param term - The lowercase search term
   * @param hits - Array to accumulate matching results
   */
  private async searchMessagesInChannel(channelId: string, term: string, hits: WsSearchResult[]): Promise<void> {
    const msgSnap = await getDocs(
      query(collection(this.fs, `channels/${channelId}/messages`), orderBy('createdAt', 'desc'), limit(40))
    );

    for (const d of msgSnap.docs) {
      const data: any = d.data();
      const text = String(data?.text ?? '');
      if (text && text.toLowerCase().includes(term)) {
        hits.push({ kind: 'message', channelId, text });
        if (hits.length >= 10) break;
      }
    }
  }

  /**
   * Handles selection of a workspace search result.
   * Navigates to the appropriate route based on result type and clears the search.
   * @param r - The selected search result
   */
  onSelectWsResult(r: WsSearchResult): void {
    if (r.kind === 'channel') this.router.navigate(['/channel', r.id]);
    if (r.kind === 'user') this.router.navigate(['/dm', r.id]);
    if (r.kind === 'message') this.router.navigate(['/channel', r.channelId]);
    this.clearWsSearch();
  }

  /**
   * Handles keyboard navigation in the workspace search results.
   * Supports arrow keys for navigation, Enter to select, and Escape to close.
   * @param ev - The keyboard event
   */
  onWsSearchKeydown(ev: KeyboardEvent): void {
    if (!this.wsSearchOpen) return;

    const results = this.wsLatestResults ?? [];
    if (!results.length) return;

    this.handleWsSearchKeyAction(ev, results);
  }

  /**
   * Dispatches keyboard events to appropriate handler based on key pressed.
   * @param ev - The keyboard event
   * @param results - Current search results array
   */
  private handleWsSearchKeyAction(ev: KeyboardEvent, results: WsSearchResult[]): void {
    if (ev.key === 'ArrowDown') {
      this.moveWsSelectionDown(ev, results);
    } else if (ev.key === 'ArrowUp') {
      this.moveWsSelectionUp(ev);
    } else if (ev.key === 'Enter') {
      this.selectWsResult(ev, results);
    } else if (ev.key === 'Escape') {
      this.closeWsSearchOnEscape(ev);
    }
  }

  /**
   * Moves the active search result selection down by one.
   * @param ev - The keyboard event to prevent default behavior
   * @param results - Search results array for bounds checking
   */
  private moveWsSelectionDown(ev: KeyboardEvent, results: WsSearchResult[]): void {
    ev.preventDefault();
    this.wsActiveIndex = Math.min(results.length - 1, this.wsActiveIndex + 1);
  }

  /**
   * Moves the active search result selection up by one.
   * @param ev - The keyboard event to prevent default behavior
   */
  private moveWsSelectionUp(ev: KeyboardEvent): void {
    ev.preventDefault();
    this.wsActiveIndex = Math.max(0, this.wsActiveIndex - 1);
  }

  /**
   * Selects the currently active search result.
   * @param ev - The keyboard event to prevent default behavior
   * @param results - Search results array to pick from
   */
  private selectWsResult(ev: KeyboardEvent, results: WsSearchResult[]): void {
    ev.preventDefault();
    const picked = results[this.wsActiveIndex];
    if (picked) this.onSelectWsResult(picked);
  }

  /**
   * Closes the workspace search when Escape key is pressed.
   * @param ev - The keyboard event to prevent default behavior
   */
  private closeWsSearchOnEscape(ev: KeyboardEvent): void {
    ev.preventDefault();
    this.closeWsSearch();
  }

  /**
   * Gets the latest search results for external access.
   * @returns Array of current search results
   */
  getLatestResults(): WsSearchResult[] {
    return this.wsLatestResults;
  }
}
