import { Injectable, inject, EnvironmentInjector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';
import { Vm } from '../../../interfaces/allInterfaces.interface';

/**
 * Service for view model (header) management
 */
@Injectable()
export class ViewModelHelper {
    private fs = inject(Firestore);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private env = inject(EnvironmentInjector);
    private platformId = inject(PLATFORM_ID);

    /**
     * Gets view model observable (header data)
     * @param composeMode$ - Observable of compose mode
     * @returns Observable of view model
     */
    getVm$(composeMode$: Observable<boolean>): Observable<Vm> {
        const baseVm$ = this.getBaseVm$();

        return composeMode$.pipe(
            switchMap((isCompose) =>
                isCompose
                    ? of<Vm>({ kind: 'channel', title: 'Neue Nachricht' })
                    : baseVm$
            )
        );
    }

    /**
     * Gets compose mode observable
     * @returns Observable of compose mode
     */
    getComposeMode$(): Observable<boolean> {
        return this.route.url.pipe(
            map((segs) => segs.some((s) => s.path === 'new')),
            startWith(this.router.url.startsWith('/new'))
        );
    }

    /**
     * Gets base view model (channel or DM)
     * @returns Observable of view model
     */
    private getBaseVm$(): Observable<Vm> {
        return this.route.paramMap.pipe(
            switchMap((params) => {
                const id = params.get('id')!;
                const isDM = this.isDM();

                if (!isPlatformBrowser(this.platformId)) {
                    return this.getServerVm(id, isDM);
                }

                if (!isDM) {
                    return this.getChannelVm(id);
                }

                return this.getDMVm(id);
            })
        );
    }

    /**
     * Gets server-side view model
     * @param id - Channel/User ID
     * @param isDM - Is DM
     * @returns Observable of view model
     */
    private getServerVm(id: string, isDM: boolean): Observable<Vm> {
        return of<Vm>(
            isDM
                ? { kind: 'dm', title: '', avatarUrl: undefined, online: undefined }
                : { kind: 'channel', title: `# ${id}`, avatarUrl: undefined, online: undefined }
        );
    }

    /**
     * Gets channel view model
     * @param id - Channel ID
     * @returns Observable of view model
     */
    private getChannelVm(id: string): Observable<Vm> {
        const chRef = doc(this.fs, `channels/${id}`);

        return runInInjectionContext(this.env, () => docData(chRef)).pipe(
            map((ch: any): Vm => ({
                kind: 'channel',
                title: `# ${ch?.name ?? id}`,
            })),
            startWith({ kind: 'channel', title: `# ${id}` } as Vm)
        );
    }

    /**
     * Gets DM view model
     * @param id - User ID
     * @returns Observable of view model
     */
    private getDMVm(id: string): Observable<Vm> {
        const uref = doc(this.fs, `users/${id}`);

        return runInInjectionContext(this.env, () => docData(uref)).pipe(
            map((u: any): Vm => {
                const online = u?.online !== undefined ? !!u.online : u?.status === 'active';

                return {
                    kind: 'dm',
                    title: String(u?.name ?? ''),
                    avatarUrl: u?.avatarUrl as string | undefined,
                    online,
                };
            }),
            startWith({
                kind: 'dm',
                title: '',
                avatarUrl: undefined,
                online: undefined,
            } as Vm)
        );
    }

    /**
     * Checks if current route is DM
     * @returns True if DM
     */
    private isDM(): boolean {
        return this.router.url.includes('/dm/');
    }
}
