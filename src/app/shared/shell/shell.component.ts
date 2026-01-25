import { Component, computed, effect, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, ActivatedRoute, ParamMap, Router, NavigationStart } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { ChannelsComponent } from '../../channels/channels.component';
import { ThreadComponent } from '../../thread/thread.component';
import { ThreadState } from '../../services/thread.state';
import { ChatRefreshService } from '../../services/chat-refresh.service';
import { trigger, transition, style, animate } from '@angular/animations';

import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  docData,
  updateDoc,
  setDoc,
  increment,
  serverTimestamp,
} from '@angular/fire/firestore';

import { Auth, authState } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, startWith, switchMap } from 'rxjs/operators';
import { UserDoc } from '../../interfaces/allInterfaces.interface';
import { PresenceService } from '../../services/presence.service';


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
  private chatRefresh = inject(ChatRefreshService);
  vm = computed(() => this.thread.vm());

  private fs = inject(Firestore);
  private route = inject(ActivatedRoute);
  private auth = inject(Auth);
  private presence = inject(PresenceService);

  users$ = collectionData(collection(this.fs, 'users'), { idField: 'id' }) as Observable<MentionUser[]>;

  // ---- Mentions: alle User ----
  usersAllForMentions$: Observable<MentionUser[]> = authState(this.auth).pipe(
    switchMap(user => {
      if (!user) return of([] as MentionUser[]);

      return collectionData(collection(this.fs, 'users'), { idField: 'id' }).pipe(
        map((rows: any[]) =>
          (rows || []).map(u => ({
            id: u?.uid ?? u?.id,
            name: u?.name ?? u?.displayName ?? 'Unbekannt',
            avatarUrl: u?.avatarUrl,
          }))
        ),
        startWith([] as MentionUser[]),
        catchError((e) => {
          console.warn('[Mentions] users stream error:', e);
          return of([] as MentionUser[]);
        })
      );
    })
  );

  usersAllForMentions: MentionUser[] = [];

  // ---- Current user (für Guest/User author) ----
  currentUser: (UserDoc & { id: string }) | null = null;

  // channelId aus der DEEPEST child route (router-outlet route)
  channelId$: Observable<string | null> = this.route.paramMap.pipe(
    switchMap(() => {
      let r: ActivatedRoute = this.route;
      while (r.firstChild) r = r.firstChild;

      return r.paramMap ? r.paramMap : of(this.route.snapshot.paramMap);
    }),
    map((pm: ParamMap) => pm.get('id')),
    distinctUntilChanged(),
    startWith(this.route.snapshot.paramMap.get('id'))
  );

  channelId: string | null = null;

  @Input() currentUserId?: string | null = null;

  mobileView: 'list' | 'chat' | 'thread' = 'list';

  constructor(
    private router: Router
  ) {
    const updateMobileView = (url: string) => {
      const isThread = url.match(/\/(channel|dm)\/[^/]+\/thread\//i);

      if (isThread) {
        this.mobileView = 'thread';
        return;
      }

      const isChat = url.startsWith('/channel/') || url.startsWith('/dm/') || url.startsWith('/new');
      const isChannelsList = url === '/channels' || url === '/channels/';

      this.mobileView = isChannelsList ? 'list' : (isChat ? 'chat' : 'list');
    };

    // Erste Setzung basierend auf der aktuellen URL (wichtig für direkte Aufrufe /new auf Mobile)
    updateMobileView(this.router.url);

    // Laufende Navigationen verfolgen
    this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe((e) => updateMobileView(e.url));

    this.presence.init();

    effect(() => {
      this.shellThreadOpen = !!this.vm().open;
    });

    this.usersAllForMentions$.subscribe(list => (this.usersAllForMentions = list));

    this.channelId$.subscribe(id => (this.channelId = id));

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
              avatarUrl: data.avatarUrl ?? '/public/images/avatars/avatar-default.svg',
              ...data,
            } as UserDoc & { id: string };
          })
        );
      })
    ).subscribe(u => (this.currentUser = u));
  }

  workspaceCollapsed = false;
  shellThreadOpen = false;

  toggleWorkspace() {
    this.workspaceCollapsed = !this.workspaceCollapsed;
  }

  onWorkspaceCollapsedChange(collapsed: boolean) {
    this.workspaceCollapsed = collapsed;
  }

  private makeConvId(a: string, b: string): string {
    return a < b ? `${a}_${b}` : `${b}_${a}`;
  }

  // SEND: schreibt in Firestore + updated parent message + updated UI
  async onSend(text: string) {
    const msg = (text || '').trim();
    if (!msg) return;

    const vm = this.thread.vm();
    if (!vm?.open || !vm.root?.id) {
      console.warn('[Thread] Kein offener Thread oder keine rootMessage.id');
      return;
    }

    const channelId = vm.channelId;
    if (!channelId) {
      console.warn('[Thread] Kein channelId gefunden. Prüfe deine Thread-VM');
      return;
    }

    const messageId = vm.root.id;
    const isDM = vm.isDM ?? false;

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
      let repliesRef, parentRef;

      if (isDM) {
        // ✅ channelId ist bereits die convId (aus ThreadState)
        repliesRef = collection(
          this.fs,
          `conversations/${channelId}/messages/${messageId}/replies`
        );
        parentRef = doc(this.fs, `conversations/${channelId}/messages/${messageId}`);
      } else {
        repliesRef = collection(
          this.fs,
          `channels/${channelId}/messages/${messageId}/replies`
        );
        parentRef = doc(this.fs, `channels/${channelId}/messages/${messageId}`);
      }

      await addDoc(repliesRef, {
        text: msg,
        authorId,
        authorName,
        authorAvatar,
        createdAt: serverTimestamp(),
        reactions: {},
        reactionBy: {},
      });
      await updateDoc(parentRef, {
        replyCount: increment(1),
        lastReplyAt: serverTimestamp(),
      }).catch(async (err) => {
        // Falls das Feld nicht existiert, initialisiere es
        if (err.code === 'not-found') {
          console.warn('[Thread] Parent-Dokument nicht gefunden, aktualisiere trotzdem...', { channelId, messageId });
          await setDoc(parentRef, {
            replyCount: 1,
            lastReplyAt: serverTimestamp(),
          }, { merge: true });
        } else {
          throw err;
        }
      });

      console.log('[Thread] Reply gespeichert:', { channelId, messageId, msg });
    } catch (err) {
      console.error('[Thread] Fehler beim Speichern der Reply:', err);
    }
  }

  onClose() {
    this.thread.close();

    // Mobile View zurück zum Chat
    if (window.innerWidth <= 1024) {
      this.mobileView = 'chat';
    }
  }

  async onEditThreadMessage(ev: { messageId: string; text: string }) {
    const vm = this.thread.vm();
    if (!vm?.open || !vm.root?.id) return;

    const channelId = this.channelId;
    if (!channelId) return;

    const rootId = vm.root.id;
    const isDM = this.router.url.includes('/dm/');

    try {
      if (ev.messageId === rootId) {
        let ref;

        if (isDM) {
          const convId = this.makeConvId(this.auth.currentUser!.uid, channelId);
          ref = doc(this.fs, `conversations/${convId}/messages/${rootId}`);
        } else {
          ref = doc(this.fs, `channels/${channelId}/messages/${rootId}`);
        }

        console.log('[Thread] Edit Root Message:', { channelId, rootId, isDM, newText: ev.text });
        await updateDoc(ref, { text: ev.text, editedAt: serverTimestamp() });
        console.log('[Thread] Root Message Saved Successfully');

        // ✅ Refresh Chat Messages
        this.chatRefresh.refresh();
      } else {
        let ref;

        if (isDM) {
          const convId = this.makeConvId(this.auth.currentUser!.uid, channelId);
          ref = doc(this.fs, `conversations/${convId}/messages/${rootId}/replies/${ev.messageId}`);
        } else {
          ref = doc(this.fs, `channels/${channelId}/messages/${rootId}/replies/${ev.messageId}`);
        }

        await updateDoc(ref, { text: ev.text, editedAt: serverTimestamp() });
      }
    } catch (e) {
      console.error('[Thread] Fehler beim Speichern der Edit:', e);
    }
  }
}
