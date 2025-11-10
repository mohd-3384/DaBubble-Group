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
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';
import { Vm } from '../interfaces/chat.interface';

type MessageVm = {
  id: string;
  text: string;
  authorName: string;
  authorAvatar?: string;
  createdAt?: Date | null;
};

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
          return of<Vm>({
            kind: 'channel',
            title: `# ${id}`,
            avatarUrl: undefined,
            online: undefined,
          });
        }

        // DM: hole Userdaten aus users/{id}
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

    /** ---------- CHAT BODY ---------- */
    /** ---------- CHAT BODY: Nachrichten ---------- */
    this.messages$ = this.route.paramMap.pipe(
      switchMap(params => {
        const channelId = params.get('id')!;
        const isDM = this.router.url.includes('/dm/');

        // SSR: keine Firestore-Calls
        if (!isPlatformBrowser(this.platformId)) {
          return of([] as MessageVm[]);
        }

        if (isDM) {
          // TODO: DM-Schema noch definieren
          return of([] as MessageVm[]);
        }

        // CHANNEL: channels/{channelId}/messages (channelId = Doc-ID = Channelname)
        const collPath = `channels/${channelId}/messages`;
        const collRef = collection(this.fs, collPath);
        const qRef = query(collRef, orderBy('createdAt', 'asc'));

        // Observable IM Injection-Kontext erzeugen (stabil für Angular + Zonen)
        const source$ = runInInjectionContext(this.env, () =>
          collectionData(qRef, { idField: 'id' }) as Observable<any[]>
        );

        // kleines Debug-Logging, damit du im Browser sofort siehst, was geladen wird
        console.log('[messages$] subscribe:', collPath);

        return source$.pipe(
          map(rows =>
            rows.map(m => ({
              id: m.id,
              text: m.text ?? '',
              authorName: m.authorName ?? 'Unbekannt',
              authorAvatar: m.authorAvatar ?? '/public/images/avatars/avatar1.svg',
              // Firestore Timestamp -> Date (failsafe)
              createdAt:
                (typeof m.createdAt?.toDate === 'function' ? m.createdAt.toDate() : null) as Date | null,
            }))
          ),
          startWith([] as MessageVm[])
        );
      })
    );

  }

  /** ---------- Composer-Logik ---------- */

  toggleEmoji() {
    this.showEmoji = !this.showEmoji;
  }

  onEmojiSelect(event: any) {
    const emoji = event?.emoji?.native || event?.emoji?.char || '';
    this.draft += emoji;
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
      // Hier später DM-Logik einfügen
      console.warn('DM-Nachrichten-Senden noch nicht implementiert');
      this.draft = '';
      this.showEmoji = false;
      return;
    }

    try {
      const coll = collection(this.fs, `channels/${id}/messages`);
      await addDoc(coll, {
        text: msg,
        authorName: 'Max Mustermann', // später: currentUser
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
