import { inject, Injectable } from '@angular/core';
import { collection, collectionData, Firestore, getDocs, limit, orderBy, query } from '@angular/fire/firestore';
import { from, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SearchResult } from '../interfaces/allInterfaces.interface';

/**
 * Service for searching across channels, users, and messages.
 * Provides unified search functionality for the header component.
 */
@Injectable({
  providedIn: 'root'
})
export class HeaderSearchService {
  private fs = inject(Firestore);
  private readonly DEFAULT_AVATAR = '/public/images/avatars/avatar-default.svg';

  /**
   * Searches for channels matching the given term.
   * @param term - The search term
   * @returns Observable of channel search results (max 6)
   */
  searchChannels(term: string): Observable<SearchResult[]> {
    return collectionData(collection(this.fs, 'channels'), { idField: 'id' }).pipe(
      map((rows: any[]) =>
        (rows || [])
          .map((c) => {
            const docId = String(c.id ?? '');
            const name = String(c?.name ?? '').trim();
            return { docId, name };
          })
          .filter((c) => c.name.toLowerCase().includes(term))
          .slice(0, 6)
          .map((c) => ({ kind: 'channel', id: c.docId, name: c.name } as SearchResult))
      ),
      catchError(() => of([] as SearchResult[]))
    );
  }

  /**
   * Searches for users matching the given term.
   * @param term - The search term
   * @returns Observable of user search results (max 6)
   */
  searchUsers(term: string): Observable<SearchResult[]> {
    return collectionData(collection(this.fs, 'users'), { idField: 'id' }).pipe(
      map((rows: any[]) =>
        (rows || [])
          .filter((x) => String(x?.name ?? '').toLowerCase().includes(term))
          .slice(0, 6)
          .map((x) => ({
            kind: 'user',
            id: String(x.id),
            name: String(x.name ?? 'Unbekannt'),
            avatarUrl: (x.avatarUrl as string | undefined) ?? this.DEFAULT_AVATAR,
          }) as SearchResult)
      ),
      catchError(() => of([] as SearchResult[]))
    );
  }

  /**
   * Searches through channel messages for the given term.
   * Searches up to 40 recent messages in up to 20 channels.
   * @param term - The search term to look for in messages
   * @returns Observable of message search results (max 10)
   */
  searchMessages(term: string): Observable<SearchResult[]> {
    return from(this.searchChannelMessages(term)).pipe(
      catchError(() => of([] as SearchResult[]))
    );
  }

  /**
   * Internal method to search channel messages.
   * @param term - The search term
   * @returns Promise resolving to message search results
   */
  private async searchChannelMessages(term: string): Promise<SearchResult[]> {
    try {
      const channelIds = await this.getChannelIds();
      return await this.searchMessagesInChannels(channelIds, term);
    } catch (e) {
      console.error('[HeaderSearch] message search failed:', e);
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
  private async searchMessagesInChannels(channelIds: string[], term: string): Promise<SearchResult[]> {
    const hits: SearchResult[] = [];
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
  private async searchMessagesInChannel(channelId: string, term: string, hits: SearchResult[]): Promise<void> {
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
}
