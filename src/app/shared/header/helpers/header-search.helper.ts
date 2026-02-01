import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of, combineLatest } from 'rxjs';
import { switchMap, startWith, shareReplay, map, catchError } from 'rxjs/operators';
import { SearchResult } from '../../../interfaces/allInterfaces.interface';
import { HeaderSearchService } from '../../../services/header-search.service';

/**
 * Helper service for managing header search operations
 * Handles search result navigation and keyboard interactions
 */
@Injectable({ providedIn: 'root' })
export class HeaderSearchHelper {
  private router = inject(Router);
  private auth = inject(Auth);
  private searchService = inject(HeaderSearchService);

  /**
   * Creates a search stream that combines auth state with search term
   * @param searchTerm$ - Observable of search terms
   * @param onResults - Callback to update latest results
   * @returns Observable of search results
   */
  createSearchStream(
    searchTerm$: Observable<string>,
    onResults: (results: SearchResult[]) => void
  ): Observable<SearchResult[]> {
    return combineLatest([
      authState(this.auth),
      searchTerm$
    ]).pipe(
      switchMap(([u, term]) => this.performSearch(u, term)),
      map(results => {
        onResults(results);
        return results;
      }),
      startWith([] as SearchResult[]),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  /**
   * Performs the search operation if user is authenticated and term is provided
   * @param u - The authenticated user or null
   * @param term - The search term
   * @returns Observable of search results
   */
  private performSearch(u: any, term: string): Observable<SearchResult[]> {
    if (!u || !term) {
      return of([] as SearchResult[]);
    }
    return this.combineSearchResults(term);
  }

  /**
   * Combines search results from channels, users, and messages
   * @param term - The search term
   * @returns Observable of combined search results
   */
  private combineSearchResults(term: string): Observable<SearchResult[]> {
    const channels$ = this.searchService.searchChannels(term);
    const users$ = this.searchService.searchUsers(term);
    const messages$ = this.searchService.searchMessages(term);
    return combineLatest([channels$, users$, messages$]).pipe(
      map(([c, uu, m]) => this.mergeSearchResults(c, uu, m)),
      catchError(() => of([] as SearchResult[]))
    );
  }

  /**
   * Navigates to the appropriate route based on search result type
   * @param result - The selected search result
   */
  navigateToResult(result: SearchResult): void {
    if (result.kind === 'channel') {
      this.router.navigate(['/channel', result.id]);
    } else if (result.kind === 'user') {
      this.router.navigate(['/dm', result.id]);
    } else if (result.kind === 'message') {
      this.router.navigate(['/channel', result.channelId]);
    }
  }

  /**
   * Calculates the next active index when moving down in search results
   * @param currentIndex - Current active index
   * @param resultsLength - Total number of results
   * @returns New active index
   */
  moveSelectionDown(currentIndex: number, resultsLength: number): number {
    return Math.min(resultsLength - 1, currentIndex + 1);
  }

  /**
   * Calculates the next active index when moving up in search results
   * @param currentIndex - Current active index
   * @returns New active index
   */
  moveSelectionUp(currentIndex: number): number {
    return Math.max(0, currentIndex - 1);
  }

  /**
   * Merges and limits search results from multiple sources
   * @param channels - Channel search results
   * @param users - User search results
   * @param messages - Message search results
   * @returns Merged results limited to 10 items
   */
  mergeSearchResults(
    channels: SearchResult[],
    users: SearchResult[],
    messages: SearchResult[]
  ): SearchResult[] {
    return [...channels, ...users, ...messages].slice(0, 10);
  }
}
