import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';
import { UserDoc, UserMini } from '../../../interfaces/allInterfaces.interface';
import { fixAvatar } from './message.utils';

/**
 * Service for managing user data streams
 */
@Injectable()
export class UserDataHelper {
    private fs = inject(Firestore);
    private auth = inject(Auth);
    private env = inject(EnvironmentInjector);

    /**
     * Gets observable of all users with online status
     * @returns Observable of user list
     */
    getAllUsers$(): Observable<UserMini[]> {
        return runInInjectionContext(this.env, () =>
            collectionData(collection(this.fs, 'users'), { idField: 'id' })
        ).pipe(
            map((rows: any[]): UserMini[] =>
                (rows || []).map((u: any) => ({
                    id: u.id,
                    name: u.name ?? u.displayName ?? 'Unbekannt',
                    avatarUrl: fixAvatar(u.avatarUrl),
                    online: this.getOnlineStatus(u),
                } as UserMini))
            ),
            startWith([] as UserMini[])
        );
    }

    /**
     * Gets current authenticated user with full data
     * @returns Observable of current user
     */
    getCurrentUser$(): Observable<(UserDoc & { id: string }) | null> {
        return authState(this.auth).pipe(
            switchMap((user) => {
                if (!user) return of(null);

                const uref = doc(this.fs, `users/${user.uid}`);
                return docData(uref).pipe(
                    map((raw) => this.mapUserDoc(raw, user))
                );
            })
        );
    }

    /**
     * Gets user name map for mention lookups
     * @param users$ - Observable of all users
     * @returns Observable of user name map
     */
    getUserNameMap$(users$: Observable<UserMini[]>): Observable<Map<string, string>> {
        return users$.pipe(
            map(users => new Map(users.map(u => [u.id, u.name])))
        );
    }

    /**
     * Determines online status from user data
     * @param u - User data
     * @returns True if user is online
     */
    private getOnlineStatus(u: any): boolean {
        return u.online !== undefined ? !!u.online : u.status === 'active';
    }

    /**
     * Maps raw user doc to typed user object
     * @param raw - Raw Firestore data
     * @param user - Auth user
     * @returns Typed user document
     */
    private mapUserDoc(raw: any, user: any): UserDoc & { id: string } {
        const data = (raw || {}) as any;
        return {
            id: user.uid,
            name: data.name ?? data.displayName ?? user.displayName ?? user.email ?? 'Guest',
            avatarUrl: data.avatarUrl ?? '/public/images/avatars/avatar-default.svg',
            ...data,
        } as UserDoc & { id: string };
    }
}
