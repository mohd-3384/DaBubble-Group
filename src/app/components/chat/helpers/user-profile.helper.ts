import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { take } from 'rxjs/operators';
import { fixAvatar } from './message.utils';

/**
 * Service for user profile modal management
 */
@Injectable()
export class UserProfileHelper {
    private fs = inject(Firestore);
    private route = inject(ActivatedRoute);
    private env = inject(EnvironmentInjector);

    /**
     * Opens user profile modal
     * @param userIdFromList - User ID (optional, uses route param if not provided)
     * @returns User profile data or null
     */
    async openUserProfile(
        userIdFromList?: string
    ): Promise<{
        id: string;
        name: string;
        email?: string;
        avatarUrl: string;
        status?: string;
    } | null> {
        const id = userIdFromList ?? this.route.snapshot.paramMap.get('id');
        if (!id) return null;

        const uref = doc(this.fs, `users/${id}`);

        return new Promise((resolve) => {
            runInInjectionContext(this.env, () =>
                docData(uref).pipe(take(1))
            ).subscribe((raw: any) => {
                if (!raw) {
                    resolve(null);
                    return;
                }

                resolve({
                    id,
                    name: raw.name ?? raw.displayName ?? 'Unbekannt',
                    avatarUrl: fixAvatar(raw.avatarUrl),
                    email: raw.email ?? '',
                    status: raw.status ?? 'offline',
                });
            });
        });
    }
}
