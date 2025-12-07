import { Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, ActivatedRoute, ParamMap } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { ChannelsComponent } from '../../channels/channels.component';
import { ThreadComponent } from '../../thread/thread.component';
import { ThreadState } from '../../services/thread.state';
import { trigger, transition, style, animate } from '@angular/animations';

import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  docData,
  updateDoc,
  increment,
  serverTimestamp,
} from '@angular/fire/firestore';

import { Auth, authState } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';

import { UserDoc } from '../../interfaces/user.interface';

type MentionUser = { id: string; name: string; avatarUrl?: string };

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, ChannelsComponent, ThreadComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  animations: [
    trigger('threadPanel', [
      transition(':enter', [
        style({ transform: 'translateX(16px)', opacity: 0 }),
        animate('220ms ease', style({ transform: 'translateX(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('200ms ease', style({ transform: 'translateX(16px)', opacity: 0 })),
      ]),
    ]),
  ],
})
export class ShellComponent {
  private thread = inject(ThreadState);
  vm = computed(() => this.thread.vm());

  private fs = inject(Firestore);
  private route = inject(ActivatedRoute);
  private auth = inject(Auth);

  // ---- Mentions: alle User ----
  usersAllForMentions$: Observable<MentionUser[]> = collectionData(
    collection(this.fs, 'users'),
    { idField: 'id' }
  ).pipe(
    map((rows: any[]) =>
      (rows || []).map(u => ({
        id: u.id,
        name: u?.name ?? u?.displayName ?? 'Unbekannt',
        avatarUrl: u?.avatarUrl,
      }))
    ),
    startWith([] as MentionUser[])
  );

  usersAllForMentions: MentionUser[] = [];

  // ---- Current user (für Guest/User author) ----
  currentUser: (UserDoc & { id: string }) | null = null;

  // ✅ channelId aus der DEEPEST child route (router-outlet route)
  channelId$: Observable<string | null> = this.route.paramMap.pipe(
    switchMap(() => {
      let r: ActivatedRoute = this.route;
      while (r.firstChild) r = r.firstChild;

      // ✅ immer ParamMap liefern, nie null
      return r.paramMap ? r.paramMap : of(this.route.snapshot.paramMap);
    }),
    map((pm: ParamMap) => pm.get('id')),
    distinctUntilChanged(),
    startWith(this.route.snapshot.paramMap.get('id'))
  );

  private channelId: string | null = null;

  constructor() {
    // sichere Klasse statt :has
    effect(() => {
      this.shellThreadOpen = !!this.vm().open;
    });
    // Mentions-Liste
    this.usersAllForMentions$.subscribe(list => (this.usersAllForMentions = list));

    // channelId live merken
    this.channelId$.subscribe(id => (this.channelId = id));

    // UserDoc laden (wie in Chat)
    authState(this.auth).pipe(
      switchMap(user => {
        if (!user) return of(null);

        const uref = doc(this.fs, `users/${user.uid}`);
        return docData(uref).pipe(
          map((raw: any) => {
            const data = (raw || {}) as any;
            return {
              id: user.uid,
              name: data.name ?? data.displayName ?? user.displayName ?? user.email ?? 'Guest',
              avatarUrl: data.avatarUrl ?? '/public/images/avatars/avatar1.svg',
              ...data,
            } as UserDoc & { id: string };
          })
        );
      })
    ).subscribe(u => (this.currentUser = u));
  }

  workspaceCollapsed = false;
  shellThreadOpen = false;

  onWorkspaceCollapsedChange(collapsed: boolean) {
    this.workspaceCollapsed = collapsed;
  }

  // ✅ SEND: schreibt in Firestore + updated parent message + updated UI
  async onSend(text: string) {
    const msg = (text || '').trim();
    if (!msg) return;

    const vm = this.thread.vm();
    if (!vm?.open || !vm.root?.id) {
      console.warn('[Thread] Kein offener Thread oder keine rootMessage.id');
      return;
    }

    const channelId = this.channelId;
    if (!channelId) {
      console.warn('[Thread] Kein channelId gefunden (Route param :id). Prüfe deine Route /channels/:id');
      return;
    }

    const messageId = vm.root.id;

    const authUser = this.auth.currentUser;
    if (!authUser) {
      console.warn('[Thread] Kein Auth-User vorhanden, Reply wird nicht gesendet.');
      return;
    }

    const guestEmail = 'guest@dabubble.de';
    const isGuest =
      (this.currentUser as any)?.role === 'guest' ||
      authUser.email === guestEmail;

    const authorId = authUser.uid;
    const authorName = isGuest
      ? 'Guest'
      : (this.currentUser?.name ??
        (this.currentUser as any)?.displayName ??
        authUser.displayName ??
        authUser.email ??
        'Unbekannt');

    const authorAvatar =
      this.currentUser?.avatarUrl ?? '/public/images/avatars/avatar1.svg';

    try {
      const repliesRef = collection(
        this.fs,
        `channels/${channelId}/messages/${messageId}/replies`
      );

      await addDoc(repliesRef, {
        text: msg,
        authorId,
        authorName,
        authorAvatar,
        createdAt: serverTimestamp(),
        reactions: {},
      });

      const parentRef = doc(this.fs, `channels/${channelId}/messages/${messageId}`);
      await updateDoc(parentRef, {
        replyCount: increment(1),
        lastReplyAt: serverTimestamp(),
      });

      console.log('[Thread] Reply gespeichert:', { channelId, messageId, msg });
    } catch (err) {
      console.error('[Thread] Fehler beim Speichern der Reply:', err);
    }
  }
  onClose() {
    this.thread.close();
  }
}
