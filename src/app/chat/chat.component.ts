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
import { map, switchMap, startWith } from 'rxjs/operators';
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

function toDateMaybe(ts: any): Date | null {
  return typeof ts?.toDate === 'function'
    ? ts.toDate()
    : ts instanceof Date
      ? ts
      : null;
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
        const channelId = params.get('id')!;
        const isDM = this.router.url.includes('/dm/');
        if (!isPlatformBrowser(this.platformId) || isDM) return of([] as MessageVm[]);

        const collRef = collection(this.fs, `channels/${channelId}/messages`);
        const qRef = query(collRef, orderBy('createdAt', 'asc'));
        const source$ = runInInjectionContext(this.env, () =>
          collectionData(qRef, { idField: 'id' }) as Observable<any[]>
        );

        return source$.pipe(
          map((rows) =>
            rows.map(
              (m) =>
              ({
                id: m.id,
                text: m.text ?? '',
                authorName: m.authorName ?? 'Unbekannt',
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

    // Gruppierung (wie gehabt)
    this.groups$ = this.messages$.pipe(
      map((msgs) => {
        const today = new Date();
        const buckets = new Map<string, MessageVm[]>();

        for (const m of msgs) {
          const d = m.createdAt ?? today;
          const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(m);
        }

        const groups: DayGroup[] = [...buckets.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, items]) => {
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
      map(([ch, first]) => (ch?.messageCount ?? 0) === 0 || (first?.length ?? 0) === 0)
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
  }

  /** ---------- Composer / Emoji ---------- */
  toggleEmoji(evt?: Event) {
    evt?.stopPropagation();
    this.showEmoji = !this.showEmoji;
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
    this.showMembers = !this.showMembers;
  }

  closeMembers() {
    this.showMembers = false;
  }

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

  async send(vm: Vm) {
    const msg = this.draft.trim();
    if (!msg) return;

    // Im Compose-Modus müsstest du anhand von "to" entscheiden,
    // wohin gesendet wird (Channel / DM / E-Mail etc.).
    // Hier senden wir nur in aktuellem Channel:
    const id = this.route.snapshot.paramMap.get('id')!;
    const isDM = vm.kind === 'dm';
    if (isDM) {
      console.warn('DM-Nachrichten-Senden noch nicht implementiert');
      this.draft = '';
      this.showEmoji = false;
      return;
    }

    try {
      const coll = collection(this.fs, `channels/${id}/messages`);
      await addDoc(coll, {
        text: msg,
        authorName: 'Max Mustermann',
        authorAvatar: '/public/images/avatars/avatar1.svg',
        createdAt: serverTimestamp(),
      });
      this.draft = '';
      this.showEmoji = false;
    } catch (err) {
      console.error('Fehler beim Senden:', err);
    }
  }


}
