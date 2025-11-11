import {
  Component,
  EnvironmentInjector,
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
import { Observable, of, combineLatest } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';
import { ChannelDoc, DayGroup, MessageVm, Vm } from '../interfaces/chat.interface';
import { PickerModule } from '@ctrl/ngx-emoji-mart';

function toDateMaybe(ts: any): Date | null {
  return typeof ts?.toDate === 'function' ? ts.toDate() : (ts instanceof Date ? ts : null);
}

function sameYMD(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

// "Dienstag, 14. Januar" -> Punkte entfernen, Format anpassen
function dayLabel(d: Date): string {
  const fmt = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long'
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

  vm$!: Observable<Vm>;
  messages$!: Observable<MessageVm[]>;
  groups$!: Observable<DayGroup[]>;

  /** leer/aktiv für Channel */
  isEmpty$!: Observable<boolean>;

  /** Für den Composer */
  draft = '';
  showEmoji = false;

  trackMsg = (_: number, m: MessageVm) => m.id;

  constructor() {
    /** ---------- HEADER ---------- */
    this.vm$ = this.route.paramMap.pipe(
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
          // Channel: Titel aus der ID
          return of<Vm>({ kind: 'channel', title: `# ${id}` });
        }

        // DM: user/{id}
        const uref = doc(this.fs, `users/${id}`);
        return runInInjectionContext(this.env, () => docData(uref)).pipe(
          map((u: any): Vm => ({
            kind: 'dm',
            title: String(u?.name ?? ''),
            avatarUrl: u?.avatarUrl as string | undefined,
            online: u?.online as boolean | undefined,
          })),
          startWith({ kind: 'dm', title: '', avatarUrl: undefined, online: undefined } as Vm)
        );
      })
    );

    /** ---------- CHAT BODY: Nachrichten ---------- */
    this.messages$ = this.route.paramMap.pipe(
      switchMap(params => {
        const channelId = params.get('id')!;
        const isDM = this.router.url.includes('/dm/');
        if (!isPlatformBrowser(this.platformId)) return of([] as MessageVm[]);
        if (isDM) return of([] as MessageVm[]);

        const collPath = `channels/${channelId}/messages`;
        const collRef = collection(this.fs, collPath);
        const qRef = query(collRef, orderBy('createdAt', 'asc'));

        const source$ = runInInjectionContext(this.env, () =>
          collectionData(qRef, { idField: 'id' }) as Observable<any[]>
        );

        return source$.pipe(
          map(rows => rows.map(m => ({
            id: m.id,
            text: m.text ?? '',
            authorName: m.authorName ?? 'Unbekannt',
            authorAvatar: m.authorAvatar ?? '/public/images/avatars/avatar1.svg',
            createdAt: toDateMaybe(m.createdAt),
            replyCount: (m.replyCount ?? 0) as number,
            lastReplyAt: toDateMaybe(m.lastReplyAt)
          } as MessageVm))),
          startWith([] as MessageVm[])
        );
      })
    );

    // ---------- Gruppierung nach Kalendertag (für Datums-Chips) ----------
    this.groups$ = this.messages$.pipe(
      map(msgs => {
        const today = new Date();
        const buckets = new Map<string, MessageVm[]>();

        for (const m of msgs) {
          const d = m.createdAt ?? today;
          const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(m);
        }

        // in Anzeige-Reihenfolge (aufsteigend nach Datum)
        const groups: DayGroup[] = [...buckets.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, items]) => {
            const [y, mo, da] = key.split('-').map(Number);
            const date = new Date(y, mo - 1, da);
            const isToday = sameYMD(date, today);
            return {
              label: isToday ? 'Heute' : dayLabel(date),
              isToday,
              items
            } as DayGroup;
          });

        return groups;
      })
    );

    /** ---------- CHAT BODY: leer/aktiv für Channel ---------- */
    const channelId$ = this.route.paramMap.pipe(map((p) => p.get('id')!));

    // Channel-Dokument
    const channelDoc$ = channelId$.pipe(
      switchMap((id) =>
        isPlatformBrowser(this.platformId)
          ? (docData(doc(this.fs, `channels/${id}`)) as Observable<ChannelDoc>)
          : of(<ChannelDoc>{})
      ),
      startWith(<ChannelDoc>{})
    );

    // erste Nachricht (limit(1)) – falls Zähler mal nicht stimmt
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

    this.isEmpty$ = combineLatest([channelDoc$, firstMessage$]).pipe(
      map(([ch, first]) => (ch?.messageCount ?? 0) === 0 || (first?.length ?? 0) === 0)
    );
  }

  /** ---------- Composer ---------- */

  toggleEmoji(evt?: Event) {
    evt?.stopPropagation();
    this.showEmoji = !this.showEmoji;
  }

  composePlaceholder(vm: Vm): string {
    const who = vm.title || '';
    return `Nachricht an ${who}`;
  }

  closeEmoji() {
    this.showEmoji = false;
  }

  onEmojiSelect(e: any) {
    const native =
      e?.emoji?.native ??
      e?.emoji?.char ??
      e?.native ??
      e?.colons ??
      '';
    this.draft += native;
    this.showEmoji = false;
  }

  onEmojiClick(event: any) {
    const emoji = event?.detail?.unicode || event?.detail?.emoji?.unicode || '';
    this.draft += emoji;
  }

  async send(vm: Vm) {
    const msg = this.draft.trim();
    if (!msg) return;

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
        authorName: 'Max Mustermann', // TODO: currentUser
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
