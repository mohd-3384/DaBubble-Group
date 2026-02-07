import { Injectable, inject, EnvironmentInjector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, doc, docData, collection, collectionData, query, orderBy, limit } from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { Observable, of, combineLatest } from 'rxjs';
import { map, switchMap, startWith, catchError } from 'rxjs/operators';
import { ChannelDoc, UserDoc } from '../../../interfaces/allInterfaces.interface';

/**
 * Service for managing channel data streams
 */
@Injectable()
export class ChannelDataHelper {
  private fs = inject(Firestore);
  private route = inject(ActivatedRoute);
  private env = inject(EnvironmentInjector);
  private platformId = inject(PLATFORM_ID);

  /**
   * Gets channel document observable
   * @returns Observable of channel document
   */
  getChannelDoc$(): Observable<ChannelDoc | null> {
    const channelId$ = this.route.paramMap.pipe(map((p) => p.get('id')!));
    return channelId$.pipe(
      switchMap((id) => {
        if (!isPlatformBrowser(this.platformId)) {
          return of<ChannelDoc | null>(null);
        }
        return (docData(doc(this.fs, `channels/${id}`)) as Observable<any>).pipe(
          map(data => (data ? ({ id, ...data } as ChannelDoc) : null)),
          catchError(() => of<ChannelDoc | null>(null))
        );
      }),
      startWith<ChannelDoc | null>(null)
    );
  }

  /**
   * Gets channel creator user document
   * @param channelDoc$ - Channel document observable
   * @returns Observable of creator user
   */
  getChannelCreator$(channelDoc$: Observable<ChannelDoc | null>): Observable<UserDoc | null> {
    return channelDoc$.pipe(
      switchMap((ch) => {
        const uid = ch?.createdBy;
        if (!uid) return of<UserDoc | null>(null);
        return (docData(doc(this.fs, `users/${uid}`)) as Observable<any>).pipe(
          map(u => (u ? ({ id: uid, ...u } as UserDoc) : null)),
          catchError(() => of<UserDoc | null>(null))
        );
      }),
      startWith<UserDoc | null>(null)
    );
  }

  /**
   * Gets channel empty state (no messages)
   * @param channelDoc$ - Channel document observable
   * @returns Observable of empty state
   */
  getIsEmpty$(channelDoc$: Observable<ChannelDoc | null>): Observable<boolean> {
    const channelId$ = this.route.paramMap.pipe(map((p) => p.get('id')!));
    const firstMessage$ = channelId$.pipe(
      switchMap((id) =>
        isPlatformBrowser(this.platformId)
          ? (collectionData(
            query(
              collection(this.fs, `channels/${id}/messages`),
              orderBy('createdAt', 'asc'),
              limit(1)
            ),
            { idField: 'id' }
          ) as Observable<any[]>)
          : of<any[]>([])
      ),
      startWith<any[]>([])
    );
    return combineLatest([channelDoc$, firstMessage$]).pipe(
      map(([ch, first]) =>
        (ch?.messageCount ?? 0) === 0 && (first?.length ?? 0) === 0
      )
    );
  }
}
