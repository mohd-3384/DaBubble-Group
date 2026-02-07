import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { SuggestItem, UserMini } from '../../../interfaces/allInterfaces.interface';
import { normalize } from './message.utils';

/**
 * Service for autocomplete suggestions
 */
@Injectable()
export class SuggestHelper {
    private fs = inject(Firestore);
    private env = inject(EnvironmentInjector);

    /**
     * Gets all channels for suggestions
     * @returns Observable of channel list
     */
    getChannelsAll$(): Observable<{ id: string; name: string }[]> {
        return runInInjectionContext(this.env, () =>
            collectionData(collection(this.fs, 'channels'), { idField: 'id' })
        ).pipe(
            map((rows: any[]) =>
                (rows || [])
                    .map((r: any) => ({
                        id: String(r?.id || ''),
                        name: String(r?.name ?? '').trim(),
                    }))
                    .filter((x) => !!x.id && !!x.name)
            ),
            startWith([] as { id: string; name: string }[])
        );
    }

    /**
     * Gets suggestions based on search input
     * @param toInput$ - Observable of search input
     * @param channelsAll$ - Observable of all channels
     * @param usersAll$ - Observable of all users
     * @returns Observable of suggestions
     */
    getSuggestions$(
        toInput$: Observable<string>,
        channelsAll$: Observable<{ id: string; name: string }[]>,
        usersAll$: Observable<UserMini[]>
    ): Observable<SuggestItem[]> {
        return combineLatest([
            toInput$.pipe(startWith('')),
            channelsAll$,
            usersAll$,
        ]).pipe(
            map(([raw, channels, users]) => this.filterSuggestions(raw, channels, users))
        );
    }

    /**
     * Filters suggestions based on search term
     * @param raw - Raw search input
     * @param channels - All channels
     * @param users - All users
     * @returns Filtered suggestions
     */
    private filterSuggestions(
        raw: string,
        channels: { id: string; name: string }[],
        users: UserMini[]
    ): SuggestItem[] {
        const q = normalize(raw);
        if (!q) return [] as SuggestItem[];

        const term = this.extractSearchTerm(q);

        if (q.startsWith('#')) {
            return this.getChannelSuggestions(channels, term);
        }

        if (q.startsWith('@')) {
            return this.getUserSuggestions(users, term);
        }

        return this.getMixedSuggestions(channels, users, term);
    }

    /**
     * Extracts search term without prefix
     * @param q - Query string
     * @returns Search term
     */
    private extractSearchTerm(q: string): string {
        return q.startsWith('#') || q.startsWith('@') ? normalize(q.slice(1)) : q;
    }

    /**
     * Gets channel suggestions
     * @param channels - All channels
     * @param term - Search term
     * @returns Channel suggestions
     */
    private getChannelSuggestions(
        channels: { id: string; name: string }[],
        term: string
    ): SuggestItem[] {
        return channels
            .filter(c => normalize(c.name).includes(term))
            .slice(0, 8)
            .map<SuggestItem>(c => ({
                kind: 'channel',
                id: c.id,
                label: `# ${c.name}`,
                value: `#${c.name}`,
            }));
    }

    /**
     * Gets user suggestions
     * @param users - All users
     * @param term - Search term
     * @returns User suggestions
     */
    private getUserSuggestions(users: UserMini[], term: string): SuggestItem[] {
        return users
            .filter(u => normalize(u.name).includes(term))
            .slice(0, 8)
            .map<SuggestItem>(u => ({
                kind: 'user',
                id: u.id,
                label: `@${u.name}`,
                value: `@${u.name}`,
                avatarUrl: u.avatarUrl,
            }));
    }

    /**
     * Gets mixed channel and user suggestions
     * @param channels - All channels
     * @param users - All users
     * @param term - Search term
     * @returns Mixed suggestions
     */
    private getMixedSuggestions(
        channels: { id: string; name: string }[],
        users: UserMini[],
        term: string
    ): SuggestItem[] {
        const channelMatches = this.getChannelSuggestions(channels, term).slice(0, 4);
        const userMatches = this.getUserSuggestions(users, term).slice(0, 4);

        return [...channelMatches, ...userMatches];
    }
}
