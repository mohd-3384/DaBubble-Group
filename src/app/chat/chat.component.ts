import {
  Component,
  EnvironmentInjector,
  HostListener,
  PLATFORM_ID,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  doc,
  docData,
  collection,
  collectionData,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  limit,
} from '@angular/fire/firestore';
import { Observable, of, combineLatest, BehaviorSubject } from 'rxjs';
import { map, switchMap, startWith, take } from 'rxjs/operators';
import {
  ChannelDoc,
  DayGroup,
  MemberDenorm,
  MemberVM,
  MessageVm,
  SuggestItem,
  Vm,
} from '../interfaces/chat.interface';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { UserDoc } from '../interfaces/user.interface';
import { Auth, authState } from '@angular/fire/auth';
import { ThreadState } from '../services/thread.state';

function toDateMaybe(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts?.toDate === 'function') return ts.toDate();
  if (ts instanceof Date) return ts;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function sameYMD(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function dayLabel(d: Date): string {
  const fmt = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  return fmt.format(d).replace(/\./g, '').replace(/\s+/g, ' ');
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fs = inject(Firestore);
  private env = inject(EnvironmentInjector);
  private platformId = inject(PLATFORM_ID);
  private guestUser: UserDoc & { id: string } = {
    id: 'guest',
    name: 'Guest',
    email: '',
    status: 'active',
    avatarUrl: '/public/images/avatars/avatar-default.svg',
    role: 'guest',
  };

  currentUser: (UserDoc & { id: string }) | null = null;


  private auth = inject(Auth);
  private thread = inject(ThreadState);

  // UI-VMs
  vm$!: Observable<Vm>;
  messages$!: Observable<MessageVm[]>;
  groups$!: Observable<DayGroup[]>;
  isEmpty$!: Observable<boolean>;

  // Composer
  to = '';
  private toInput$ = new BehaviorSubject<string>('');
  suggestOpen = false;
  suggestIndex = -1;
  draft = '';
  showEmoji = false;
  showMembers = false;

  // Header-Mitglieder (Channel)
  members$!: Observable<MemberVM[]>;
  trackMsg = (_: number, m: MessageVm) => m.id;
  trackMember = (_: number, m: MemberVM) => m.uid;

  channelsAll$!: Observable<{ id: string }[]>;
  usersAll$!: Observable<{ id: string; name: string; avatarUrl?: string }[]>;
  suggestions$!: Observable<SuggestItem[]>;

  // Compose-Modus (= /new)
  composeMode$ = this.route.url.pipe(
    map((segs) => segs.some((s) => s.path === 'new')),
    startWith(this.router.url.startsWith('/new'))
  );

  private fixAvatar(url?: string) {
    if (!url) return '/public/images/avatars/avatar-default.svg';
    return url.startsWith('/') ? url : '/' + url;
  }

  private makeConvId(a: string, b: string): string {
    return a < b ? `${a}_${b}` : `${b}_${a}`;
  }


  // call this from (input) in HTML
  onToInput(v: string) {
    this.to = v;
    this.toInput$.next(v);
    this.suggestOpen = true;
  }

  // Keyboard im "An:"-Feld
  onToKeydown(ev: KeyboardEvent, list: SuggestItem[] | null | undefined) {
    if (!this.suggestOpen || !list || list.length === 0) return;
    const max = list.length - 1;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.suggestIndex = Math.min(max, this.suggestIndex + 1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.suggestIndex = Math.max(0, this.suggestIndex - 1);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (this.suggestIndex >= 0 && this.suggestIndex <= max) {
        this.pickSuggestion(list[this.suggestIndex]);
      }
    } else if (ev.key === 'Escape') {
      this.suggestOpen = false;
    }
  }

  /** Klick irgendwo außerhalb -> Vorschlagsliste schließen */
  @HostListener('document:click')
  onDocumentClick() {
    this.suggestOpen = false;
    this.suggestIndex = -1;
    this.showMembers = false;
  }

  // Auswahl per Klick/Enter
  pickSuggestion(s: SuggestItem) {
    this.to = s.value;
    this.toInput$.next(this.to);
    this.suggestOpen = false;
    this.suggestIndex = -1;
  }

  // Hilfsfilter
  private normalize(s: string) {
    return (s || '').toLowerCase().trim();
  }

  constructor() {
    /** ---------- HEADER ---------- */
    const baseVm$ = this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id')!;
        const isDM = this.router.url.includes('/dm/');

        if (!isPlatformBrowser(this.platformId)) {
          return of<Vm>(
            isDM
              ? { kind: 'dm', title: '', avatarUrl: undefined, online: undefined }
              : { kind: 'channel', title: `# ${id}`, avatarUrl: undefined, online: undefined }
          );
        }

        if (!isDM) {
          return of<Vm>({ kind: 'channel', title: `# ${id}` });
        }

        const uref = doc(this.fs, `users/${id}`);
        return runInInjectionContext(this.env, () => docData(uref)).pipe(
          map(
            (u: any): Vm => ({
              kind: 'dm',
              title: String(u?.name ?? ''),
              avatarUrl: u?.avatarUrl as string | undefined,
              online: u?.online as boolean | undefined,
            })
          ),
          startWith({ kind: 'dm', title: '', avatarUrl: undefined, online: undefined } as Vm)
        );
      })
    );

    // Wenn composeMode aktiv ist, Header überschreiben
    this.vm$ = this.composeMode$.pipe(
      switchMap((isCompose) =>
        isCompose ? of<Vm>({ kind: 'channel', title: 'Neue Nachricht' }) : baseVm$
      )
    );

    /** ---------- MEMBERS im Header (nur Channel) ---------- */
    this.members$ = this.route.paramMap.pipe(
      map((params) => params.get('id')!),
      switchMap((id) => {
        if (!isPlatformBrowser(this.platformId)) return of([] as MemberVM[]);
        const ref = collection(this.fs, `channels/${id}/members`);
        const source$ = runInInjectionContext(this.env, () =>
          collectionData(ref, { idField: 'uid' }) as Observable<any[]>
        );
        return source$.pipe(
          map((rows) =>
            (rows as MemberDenorm[]).map(
              (r) =>
              ({
                uid: r.uid,
                name: r.displayName ?? 'Member',
                avatarUrl: this.fixAvatar(r.avatarUrl),
              } as MemberVM)
            )
          ),
          startWith([] as MemberVM[])
        );
      })
    );

    /** ---------- NACHRICHTEN ---------- */
    const baseMessages$ = this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id')!;               // bei Channel: channelId, bei DM: otherUserId
        const isDM = this.router.url.includes('/dm/');

        // Server-Side-Rendering / kein Browser
        if (!isPlatformBrowser(this.platformId)) {
          return of([] as MessageVm[]);
        }

        // 🔹 CHANNEL: wie bisher
        if (!isDM) {
          const collRef = collection(this.fs, `channels/${id}/messages`);
          const qRef = query(collRef, orderBy('createdAt', 'asc'));
          const source$ = runInInjectionContext(this.env, () =>
            collectionData(qRef, { idField: 'id' }) as Observable<any[]>
          );

          const guestEmail = 'guest@dabubble.de';

          return source$.pipe(
            map((rows) =>
              rows.map(
                (m) =>
                ({
                  id: m.id,
                  text: m.text ?? '',
                  authorName:
                    m.authorName === guestEmail
                      ? 'Guest'
                      : (m.authorName ?? 'Unbekannt'),
                  authorAvatar: m.authorAvatar ?? '/public/images/avatars/avatar1.svg',
                  createdAt: toDateMaybe(m.createdAt),
                  replyCount: (m.replyCount ?? 0) as number,
                  lastReplyAt: toDateMaybe(m.lastReplyAt),
                } as MessageVm)
              )
            ),
            startWith([] as MessageVm[])
          );
        }

        // 🔹 DM: Nachrichten aus conversations/{convId}/messages laden
        const me = this.auth.currentUser;
        if (!me) {
          return of([] as MessageVm[]);
        }

        const convId = this.makeConvId(me.uid, id);
        const collRef = collection(this.fs, `conversations/${convId}/messages`);
        const qRef = query(collRef, orderBy('createdAt', 'asc'));
        const source$ = runInInjectionContext(this.env, () =>
          collectionData(qRef, { idField: 'id' }) as Observable<any[]>
        );

        const guestEmail = 'guest@dabubble.de';

        return source$.pipe(
          map((rows) =>
            rows.map(
              (m) =>
              ({
                id: m.id,
                text: m.text ?? '',
                authorName:
                  m.authorName === guestEmail
                    ? 'Guest'
                    : (m.authorName ?? 'Unbekannt'),
                authorAvatar: m.authorAvatar ?? '/public/images/avatars/avatar1.svg',
                createdAt: toDateMaybe(m.createdAt),
                replyCount: (m.replyCount ?? 0) as number,
                lastReplyAt: toDateMaybe(m.lastReplyAt),
              } as MessageVm)
            )
          ),
          startWith([] as MessageVm[])
        );
      })
    );


    // Im Compose-Modus keine Nachrichten laden
    this.messages$ = this.composeMode$.pipe(
      switchMap((isCompose) => (isCompose ? of([] as MessageVm[]) : baseMessages$))
    );

    // Gruppierung
    this.groups$ = this.messages$.pipe(
      map((msgs) => {
        const today = new Date();
        const buckets = new Map<string, MessageVm[]>();

        for (const m of msgs) {
          const d = m.createdAt;
          if (!d) continue;

          const key =
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(m);
        }

        const groups: DayGroup[] = [...buckets.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, items]) => {
            items.sort((a, b) => (a.createdAt!.getTime() - b.createdAt!.getTime()));

            const [y, mo, da] = key.split('-').map(Number);
            const date = new Date(y, mo - 1, da);
            const isToday = sameYMD(date, today);

            return { label: isToday ? 'Heute' : dayLabel(date), isToday, items } as DayGroup;
          });

        return groups;
      })
    );


    /** ---------- LEER/AKTIV ---------- */
    const channelId$ = this.route.paramMap.pipe(map((p) => p.get('id')!));
    const channelDoc$ = channelId$.pipe(
      switchMap((id) =>
        isPlatformBrowser(this.platformId)
          ? (docData(doc(this.fs, `channels/${id}`)) as Observable<ChannelDoc>)
          : of(<ChannelDoc>{})
      ),
      startWith(<ChannelDoc>{})
    );
    const firstMessage$ = channelId$.pipe(
      switchMap((id) =>
        isPlatformBrowser(this.platformId)
          ? (collectionData(
            query(collection(this.fs, `channels/${id}/messages`), orderBy('createdAt', 'asc'), limit(1)),
            { idField: 'id' }
          ) as Observable<any[]>)
          : of<any[]>([])
      ),
      startWith<any[]>([])
    );
    const baseIsEmpty$ = combineLatest([channelDoc$, firstMessage$]).pipe(
      map(([ch, first]) => (ch?.messageCount ?? 0) === 0 && (first?.length ?? 0) === 0)
    );
    this.isEmpty$ = this.composeMode$.pipe(
      switchMap((isCompose) => (isCompose ? of(true) : baseIsEmpty$))
    );

    // ---- Quellen für Channels / Users (nur Name/Id – leichtgewichtig) ----
    this.channelsAll$ = runInInjectionContext(this.env, () =>
      collectionData(collection(this.fs, 'channels'), { idField: 'id' }) // <-- idField !
    ).pipe(
      map((rows: any[]) =>
        (rows || []).map((r: any) => ({ id: String(r?.id || '') })).filter(x => !!x.id)
      ),
      startWith([])
    );

    this.usersAll$ = runInInjectionContext(this.env, () =>
      collectionData(collection(this.fs, 'users'), { idField: 'id' })
    ).pipe(
      map((rows: any[]) =>
        (rows || []).map((u: any) => ({
          id: u.id,
          name: u?.name ?? u?.displayName ?? 'Unbekannt',
          avatarUrl: this.fixAvatar(u?.avatarUrl),
        }))
      ),
      startWith([])
    );

    // ---- Autocomplete zusammenbauen ----
    this.suggestions$ = combineLatest([
      this.toInput$.pipe(startWith('')),
      this.channelsAll$,
      this.usersAll$,
    ]).pipe(
      map(([raw, channels, users]) => {
        const q = this.normalize(raw);
        if (!q) return [] as SuggestItem[];

        // #channel
        if (q.startsWith('#')) {
          const term = this.normalize(q.slice(1));
          const matches = channels
            .filter(c => this.normalize(c.id).includes(term))
            .slice(0, 8)
            .map<SuggestItem>(c => ({
              kind: 'channel',
              id: c.id,
              label: `# ${c.id}`,  // <— sichtbar im Dropdown
              value: `#${c.id}`,   // <— was in das Feld geschrieben wird
            }));
          return matches;
        }

        // @user
        if (q.startsWith('@')) {
          const term = this.normalize(q.slice(1));
          const matches = users
            .filter((u) => this.normalize(u.name).includes(term))
            .slice(0, 8)
            .map<SuggestItem>((u) => ({
              kind: 'user',
              id: u.id,
              label: `@${u.name}`,
              value: `@${u.name}`,
              avatarUrl: u.avatarUrl,
            }));
          return matches;
        }

        // email fallback (ein einfacher Check)
        const looksLikeMail = q.includes('@') && q.includes('.');
        if (looksLikeMail) {
          return [
            {
              kind: 'email',
              label: `E-Mail an ${raw}`,
              value: raw,
            } as SuggestItem,
          ];
        }

        // ansonsten beide Listen als Vorschlag (Top 8)
        const both = [
          ...channels.slice(0, 4).map<SuggestItem>((c) => ({
            kind: 'channel',
            id: c.id,
            label: `# ${c.id}`,
            value: `#${c.id}`,
          })),
          ...users.slice(0, 4).map<SuggestItem>((u) => ({
            kind: 'user',
            id: u.id,
            label: `@${u.name}`,
            value: `@${u.name}`,
            avatarUrl: u.avatarUrl,
          })),
        ];
        return both;
      })
    );

    // Auth-Status beobachten und dazugehöriges users-Dokument laden
    authState(this.auth).pipe(
      switchMap(user => {
        if (!user) return of(null);

        const uref = doc(this.fs, `users/${user.uid}`);
        return docData(uref).pipe(
          map(raw => {
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
    ).subscribe(u => {
      this.currentUser = u;
    });
  }

  /** ---------- Composer / Emoji ---------- */
  toggleEmoji(evt?: Event) {
    evt?.stopPropagation();
    const next = !this.showEmoji;
    this.showEmoji = next;
    if (next) this.showMembers = false;
  }

  closeEmoji() {
    this.showEmoji = false;
  }

  onEmojiSelect(e: any) {
    const native = e?.emoji?.native ?? e?.emoji?.char ?? e?.native ?? e?.colons ?? '';
    this.draft += native;
    this.showEmoji = false;
  }

  onEmojiClick(event: any) {
    const emoji = event?.detail?.unicode || event?.detail?.emoji?.unicode || '';
    this.draft += emoji;
  }

  toggleMembers(evt?: Event) {
    evt?.stopPropagation();
    const next = !this.showMembers;
    this.showMembers = next;
    if (next) this.showEmoji = false;
  }

  closeMembers() {
    this.showMembers = false;
  }

  closeAllPopovers() { this.showEmoji = false; this.showMembers = false; }

  insertMention(m: MemberVM) {
    const name = m.name ?? 'Member';
    const mention = `@${name}`;

    const base = this.draft || '';
    const needsSpace = base.length > 0 && !/\s$/.test(base);

    this.draft = base + (needsSpace ? ' ' : '') + mention + ' ';
    this.showMembers = false;
  }

  composePlaceholder(vm: Vm): string {
    const who = vm.title || '';
    return `Nachricht an ${who}`;
  }

  openThread(m: any, vm: any) {
    const channelId = this.route.snapshot.paramMap.get('id');
    if (!channelId) return;

    this.thread.openThread({
      channelId,
      header: { title: 'Thread', channel: vm.title },
      root: {
        id: m.id,
        author: { id: m.authorId ?? '', name: m.authorName, avatarUrl: m.authorAvatar },
        text: m.text,
        createdAt: m.createdAt ?? new Date(),
      },
    });
  }

  async send(vm: Vm) {
    const msg = this.draft.trim();
    if (!msg) return;

    const id = this.route.snapshot.paramMap.get('id')!;
    const isDM = vm.kind === 'dm';

    const authUser = this.auth.currentUser;
    if (!authUser) {
      console.warn('Kein Auth-User vorhanden, Nachricht wird nicht gesendet.');
      return;
    }

    const u = this.currentUser;

    const guestEmail = 'guest@dabubble.de';
    const isGuest =
      u?.role === 'guest' ||
      authUser.email === guestEmail;

    const authorId = authUser.uid;
    const authorName = isGuest
      ? 'Guest'
      : (u?.name ??
        (u as any)?.displayName ??
        authUser.displayName ??
        authUser.email ??
        'Unbekannt');

    const authorAvatar =
      u?.avatarUrl ?? '/public/images/avatars/avatar1.svg';

    try {
      if (!isDM) {
        const coll = collection(this.fs, `channels/${id}/messages`);
        await addDoc(coll, {
          text: msg,
          authorId,
          authorName,
          authorAvatar,
          createdAt: serverTimestamp(),
          replyCount: 0,
          reactions: {},
        });
      } else {
        const otherUserId = id;
        const convId = this.makeConvId(authorId, otherUserId);

        const coll = collection(this.fs, `conversations/${convId}/messages`);
        await addDoc(coll, {
          text: msg,
          authorId,
          authorName,
          authorAvatar,
          createdAt: serverTimestamp(),
        });
      }

      this.draft = '';
      this.showEmoji = false;
    } catch (err) {
      console.error('Fehler beim Senden:', err);
    }
  }


}
