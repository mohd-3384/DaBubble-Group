import { Injectable, inject, EnvironmentInjector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, collection, collectionData, query, orderBy } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, of, combineLatest } from 'rxjs';
import { map, switchMap, startWith, catchError } from 'rxjs/operators';
import { MessageVm, UserMini } from '../../../interfaces/allInterfaces.interface';
import { toDateMaybe } from './date.utils';
import { makeConvId } from './conversation.utils';
import { ChatRefreshService } from '../../../services/chat-refresh.service';

/**
 * Service for managing message data streams
 */
@Injectable()
export class MessageDataHelper {
  private fs = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private env = inject(EnvironmentInjector);
  private platformId = inject(PLATFORM_ID);
  private chatRefresh = inject(ChatRefreshService);

  /**
   * Gets messages observable for current route (channel or DM)
   * @param usersAll$ - Observable of all users
   * @returns Observable of message view models
   */
  getMessages$(usersAll$: Observable<UserMini[]>): Observable<MessageVm[]> {
    return combineLatest([
      this.route.paramMap.pipe(map(p => p.get('id')!)),
      authState(this.auth).pipe(startWith(this.auth.currentUser)),
      usersAll$,
      this.chatRefresh.refreshTrigger$,
    ]).pipe(
      switchMap(([id, me, users]) => {
        const userMap = new Map(users.map(u => [u.id, u]));
        const isDM = this.isDM();

        if (!isPlatformBrowser(this.platformId)) {
          return of([] as MessageVm[]);
        }

        if (!isDM) {
          return this.getChannelMessages$(id, userMap);
        }

        if (!me) return of([] as MessageVm[]);
        return this.getDMMessages$(me.uid, id, userMap);
      })
    );
  }

  /**
   * Gets channel messages
   * @param channelId - Channel ID
   * @param userMap - Map of user IDs to user data
   * @returns Observable of messages
   */
  private getChannelMessages$(
    channelId: string,
    userMap: Map<string, UserMini>
  ): Observable<MessageVm[]> {
    const collRef = collection(this.fs, `channels/${channelId}/messages`);
    const qRef = query(collRef, orderBy('createdAt', 'asc'));

    return runInInjectionContext(this.env, () =>
      collectionData(qRef, { idField: 'id' }) as Observable<any[]>
    ).pipe(
      map(rows => this.mapMessages(rows, userMap)),
      catchError(() => of([] as MessageVm[])),
      startWith([] as MessageVm[])
    );
  }

  /**
   * Gets DM messages
   * @param meUid - Current user ID
   * @param otherUid - Other user ID
   * @param userMap - Map of user IDs to user data
   * @returns Observable of messages
   */
  private getDMMessages$(
    meUid: string,
    otherUid: string,
    userMap: Map<string, UserMini>
  ): Observable<MessageVm[]> {
    const convId = makeConvId(meUid, otherUid);
    const collRef = collection(this.fs, `conversations/${convId}/messages`);
    const qRef = query(collRef, orderBy('createdAt', 'asc'));

    return runInInjectionContext(this.env, () =>
      collectionData(qRef, { idField: 'id' }) as Observable<any[]>
    ).pipe(
      map(rows => this.mapMessages(rows, userMap)),
      catchError(() => of([] as MessageVm[])),
      startWith([] as MessageVm[])
    );
  }

  /**
   * Maps raw message data to view models
   * @param rows - Raw message data
   * @param userMap - Map of user IDs to user data
   * @returns Array of message view models
   */
  private mapMessages(rows: any[], userMap: Map<string, UserMini>): MessageVm[] {
    return rows.map(m => {
      const u = userMap.get(m.authorId ?? '');
      return {
        id: m.id,
        text: m.text ?? '',
        authorId: m.authorId ?? '',
        authorName: u?.name ?? m.authorName ?? 'Unbekannt',
        authorAvatar: u?.avatarUrl ?? m.authorAvatar ?? '/public/images/avatars/avatar-default.svg',
        createdAt: toDateMaybe(m.createdAt),
        replyCount: m.replyCount ?? 0,
        lastReplyAt: toDateMaybe(m.lastReplyAt),
        reactions: m.reactions ?? {},
        reactionBy: m.reactionBy ?? {},
      } as MessageVm;
    });
  }

  /**
   * Checks if current route is a DM
   * @returns True if DM route
   */
  private isDM(): boolean {
    return this.router.url.includes('/dm/');
  }
}
