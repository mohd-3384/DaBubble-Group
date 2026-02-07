import { Injectable, inject, EnvironmentInjector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { Observable, of, combineLatest } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';
import { MemberDenorm, MemberVM, UserMini } from '../../../interfaces/allInterfaces.interface';
import { fixAvatar } from './message.utils';

/**
 * Service for managing channel member data
 */
@Injectable()
export class MemberDataHelper {
    private fs = inject(Firestore);
    private route = inject(ActivatedRoute);
    private env = inject(EnvironmentInjector);
    private platformId = inject(PLATFORM_ID);

    /**
     * Gets channel members with online status
     * @param usersAll$ - Observable of all users
     * @returns Observable of member view models
     */
    getMembers$(usersAll$: Observable<UserMini[]>): Observable<MemberVM[]> {
        const membersRaw$ = this.getMembersRaw$();

        return combineLatest([membersRaw$, usersAll$]).pipe(
            map(([members, users]) => this.mapMembers(members, users)),
            startWith([] as MemberVM[])
        );
    }

    /**
     * Gets suggestions for adding members (excludes existing members)
     * @param usersAll$ - Observable of all users
     * @param members$ - Observable of current members
     * @param searchInput$ - Observable of search input
     * @returns Observable of user suggestions
     */
    getAddMemberSuggestions$(
        usersAll$: Observable<UserMini[]>,
        members$: Observable<MemberVM[]>,
        searchInput$: Observable<string>
    ): Observable<UserMini[]> {
        return combineLatest([
            searchInput$.pipe(startWith('')),
            usersAll$,
            members$.pipe(startWith([] as MemberVM[])),
        ]).pipe(
            map(([query, users, members]) => this.filterSuggestions(query, users, members))
        );
    }

    /**
     * Gets raw member data from Firestore
     * @returns Observable of raw member data
     */
    private getMembersRaw$(): Observable<MemberDenorm[]> {
        return this.route.paramMap.pipe(
            map((params) => params.get('id')!),
            switchMap((id) => {
                if (!isPlatformBrowser(this.platformId)) {
                    return of([] as MemberDenorm[]);
                }

                const ref = collection(this.fs, `channels/${id}/members`);
                return runInInjectionContext(this.env, () =>
                    collectionData(ref, { idField: 'id' }) as Observable<any[]>
                ).pipe(
                    map((rows) => rows as MemberDenorm[]),
                    startWith([] as MemberDenorm[])
                );
            })
        );
    }

    /**
     * Maps raw members to view models with online status
     * @param members - Raw member data
     * @param users - All users
     * @returns Mapped member view models
     */
    private mapMembers(members: MemberDenorm[], users: UserMini[]): MemberVM[] {
        const userMap = new Map(users.map((u) => [u.id, u]));

        return members.map((m: any) => {
            const uid = m.uid || m.id;
            const u = userMap.get(uid);

            return {
                uid,
                name: m.displayName ?? u?.name ?? 'Member',
                avatarUrl: fixAvatar(m.avatarUrl ?? u?.avatarUrl),
                online: u?.online ?? false,
            } as MemberVM;
        });
    }

    /**
     * Filters users for add member suggestions
     * @param query - Search query
     * @param users - All users
     * @param members - Current members
     * @returns Filtered suggestions
     */
    private filterSuggestions(
        query: string,
        users: UserMini[],
        members: MemberVM[]
    ): UserMini[] {
        const q = (query || '').trim().toLowerCase();
        if (!q) return [];

        const memberIds = new Set(members.map(m => m.uid));

        return users
            .filter(u => !memberIds.has(u.id))
            .filter(u => u.name.toLowerCase().includes(q))
            .slice(0, 8);
    }
}
