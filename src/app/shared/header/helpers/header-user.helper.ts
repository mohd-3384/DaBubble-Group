import { inject, Injectable } from '@angular/core';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { map, switchMap, startWith, catchError } from 'rxjs/operators';
import { HeaderUser, UserDoc } from '../../../interfaces/allInterfaces.interface';

/**
 * Helper service for managing header user data
 * Handles user authentication state and Firestore user document synchronization
 */
@Injectable({ providedIn: 'root' })
export class HeaderUserHelper {
    private fs = inject(Firestore);
    private auth = inject(Auth);
    private readonly DEFAULT_AVATAR = '/public/images/avatars/avatar-default.svg';

    /**
     * Guest user fallback when no user is authenticated
     */
    private guestUser: HeaderUser = {
        id: 'guest',
        name: 'Guest',
        email: 'guest@dabubble.de',
        status: 'active',
        avatarUrl: this.DEFAULT_AVATAR,
        online: true,
    };

    /**
     * Creates an observable stream of the current user
     * Syncs with Firebase Auth and Firestore user document
     * @returns Observable of HeaderUser
     */
    getUserStream(): Observable<HeaderUser> {
        return authState(this.auth).pipe(
            switchMap((u) => this.mapAuthStateToUser(u)),
            startWith(this.guestUser)
        );
    }

    /**
     * Maps Firebase Auth user to HeaderUser observable
     * @param u - Firebase Auth user or null
     * @returns Observable of HeaderUser
     */
    private mapAuthStateToUser(u: any): Observable<HeaderUser> {
        if (!u) return of(this.guestUser);

        const uref = doc(this.fs, `users/${u.uid}`);
        return docData(uref, { idField: 'id' }).pipe(
            map((raw: any) => this.buildHeaderUser(raw, u)),
            catchError(() => of(this.guestUser))
        );
    }

    /**
     * Builds a HeaderUser object from Firestore data
     * @param raw - Raw Firestore data
     * @param authUser - Firebase Auth user
     * @returns HeaderUser object
     */
    private buildHeaderUser(raw: any, authUser: any): HeaderUser {
        const data = (raw || {}) as Partial<UserDoc> & { id?: string };
        return {
            id: data.id ?? authUser.uid,
            name: String(data.name ?? '').trim() || 'Guest',
            email: String(data.email ?? authUser.email ?? 'guest@dabubble.de').trim(),
            status: (data.status === 'away' ? 'away' : 'active') as 'active' | 'away',
            avatarUrl: String(data.avatarUrl ?? '').trim() || this.DEFAULT_AVATAR,
            online: !!(data.online ?? true),
        } satisfies HeaderUser;
    }
}
