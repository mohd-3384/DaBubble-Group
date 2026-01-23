import {
  Component,
  ElementRef,
  EnvironmentInjector,
  HostListener,
  PLATFORM_ID,
  ViewChild,
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
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  deleteField,
  increment,
  runTransaction
} from '@angular/fire/firestore';
import { Observable, of, combineLatest, BehaviorSubject } from 'rxjs';
import { map, switchMap, startWith, take, catchError } from 'rxjs/operators';
import {
  ChannelDoc,
  DayGroup,
  MemberDenorm,
  MemberVM,
  MessageVm,
  SuggestItem,
  UserDoc,
  Vm,
  UserMini,
} from '../interfaces/allInterfaces.interface';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { ThreadState } from '../services/thread.state';
import { Auth, authState } from '@angular/fire/auth';
import { AuthReadyService } from '../services/auth-ready.service';
import { ChannelService } from '../services/channel.service';

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
  private authReady = inject(AuthReadyService);
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

  // für Emoji-Popover an einer Nachricht
  messageEmojiForId: string | null = null;
  emojiPopoverPos = {
    top: 0,
    left: 0,
    placement: 'bottom' as 'top' | 'bottom',
  };

  @ViewChild('toInputEl') toInputEl!: ElementRef<HTMLInputElement>;

  composeMode = false;

  currentUser: (UserDoc & { id: string }) | null = null;

  private userNameMap = new Map<string, string>();

  private auth = inject(Auth);
  private thread = inject(ThreadState);
  @ViewChild('membersBtn') membersBtn!: ElementRef<HTMLElement>;
  @ViewChild('addMembersBtn') addMembersBtn!: ElementRef<HTMLElement>;

  membersModalPos = { top: 0, left: 0 };
  addMembersModalPos = { top: 0, left: 0 };

  private positionModalFrom(el: HTMLElement, which: 'members' | 'add') {
    const rect = el.getBoundingClientRect();
    const offset = 10;

    const viewportW = window.innerWidth;
    const panelWidth = which === 'members' ? 360 : 480;

    const left = Math.min(
      viewportW - panelWidth - 16,
      Math.max(16, rect.right - panelWidth)
    );

    const top = rect.bottom + offset;

    if (which === 'members') this.membersModalPos = { top, left };
    else this.addMembersModalPos = { top, left };
  }

  // Channel-Info Modal
  channelInfoOpen = false;

  // aktueller Channel aus Firestore
  channelDoc$!: Observable<ChannelDoc | null>;
  channelTopic = '';
  channelCreator$!: Observable<UserDoc | null>;

  // Edit-States für Channel-Info
  channelNameEdit = false;
  channelDescEdit = false;

  // Eingabewerte im Edit-Modus
  editChannelName = '';
  editChannelDesc = '';

  composerEmojiPos = { top: 0, left: 0 };

  editingMessageId: string | null = null;
  editDraft = '';

  editMenuForId: string | null = null;
  editMenuPos = { top: 0, left: 0 };

  emojiOpenedFrom: 'actions' | 'reactions' | null = null;

  emojiMartCfg = {
    showPreview: false,
    showSkinTones: false,
    autoFocus: true,
    // set: 'apple', perLine: 8, emojiSize: 20, ...
  };

  toggleEditMenu(ev: MouseEvent, m: any) {
    ev.stopPropagation();
    if (!this.isOwnMessage(m)) return;
    if (this.editingMessageId === m.id) return;

    if (this.editMenuForId === m.id) {
      this.editMenuForId = null;
      return;
    }

    const btn = ev.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();

    const popW = 320;
    const offset = 8;

    const viewportW = window.innerWidth || document.documentElement.clientWidth;
    const left = Math.max(16, Math.min(rect.right - popW, viewportW - popW - 16));
    const top = rect.bottom + offset;

    this.editMenuForId = m.id;
    this.editMenuPos = { top, left };

    // andere Popover schließen
    this.messageEmojiForId = null;
    this.showEmoji = false;
    this.showMembers = false;
  }

  onMessageRowLeave(messageId: string) {
    if (this.editMenuForId === messageId) this.editMenuForId = null;

    // Emoji-Popover nur schließen, wenn er aus message-actions geöffnet wurde
    if (this.messageEmojiForId === messageId && this.emojiOpenedFrom === 'actions') {
      this.closeMessageEmojiPopover();
    }
  }

  onMessageRowLeaveKeepEmoji(messageId: string) {
    if (this.editMenuForId === messageId) this.editMenuForId = null;
  }

  @ViewChild('msgEmojiPopover') msgEmojiPopover?: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    if (!this.messageEmojiForId) return;

    const target = ev.target as Node;

    // Klick IM Popover -> nix
    const popEl = this.msgEmojiPopover?.nativeElement;
    if (popEl && popEl.contains(target)) return;

    this.closeMessageEmojiPopover();
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (!this.messageEmojiForId) return;
    this.closeMessageEmojiPopover();
  }

  @HostListener('window:touchmove', [])
  onTouchMove() {
    if (!this.messageEmojiForId) return;
    this.closeMessageEmojiPopover();
  }

  startEdit(m: any) {
    if (!this.isOwnMessage(m)) return;
    this.editMenuForId = null;
    this.messageEmojiForId = null;
    this.showEmoji = false;
    this.showMembers = false;

    this.editingMessageId = m.id;
    this.editDraft = (m.text ?? '').toString();
  }

  cancelEdit() {
    this.editingMessageId = null;
    this.editDraft = '';
    this.showEmoji = false;
    this.emojiContext = null;
  }

  closeAllPopovers() {
    this.showEmoji = false;
    this.showMembers = false;
    this.messageEmojiForId = null;
    this.editMenuForId = null;
  }

  async saveEdit(m: any, vm: Vm) {
    if (!this.isOwnMessage(m)) return;

    const next = (this.editDraft || '').trim();
    if (!next || next === (m.text ?? '').trim()) {
      this.cancelEdit();
      this.showEmoji = false;
      this.emojiContext = null;
      return;
    }

    const id = this.route.snapshot.paramMap.get('id')!;
    const authUser = await this.authReady.requireUser();

    try {
      if (vm.kind === 'dm') {
        const otherUserId = id;
        const convId = this.makeConvId(authUser.uid, otherUserId);
        const ref = doc(this.fs, `conversations/${convId}/messages/${m.id}`);
        await updateDoc(ref, { text: next, editedAt: serverTimestamp() });
      } else {
        const ref = doc(this.fs, `channels/${id}/messages/${m.id}`);
        await updateDoc(ref, { text: next, editedAt: serverTimestamp() });
      }

      this.cancelEdit();
    } catch (err) {
      console.error('[Chat] Fehler beim Editieren der Message:', err);
    }
  }

  private me$ = authState(this.auth).pipe(startWith(this.auth.currentUser));
  private chanSvc = inject(ChannelService);

  private async renameChannel(oldId: string, newIdRaw: string) {
    await this.authReady.requireUser();
    const newId = newIdRaw.trim();
    if (!newId) return;

    if (newId === oldId) return;

    const oldRef = doc(this.fs, `channels/${oldId}`);
    const newRef = doc(this.fs, `channels/${newId}`);

    // 1) prüfen, ob alter existiert
    const oldSnap = await getDoc(oldRef);
    if (!oldSnap.exists()) {
      console.warn('Alter Channel existiert nicht:', oldId);
      return;
    }

    // 2) prüfen, ob neuer schon existiert
    const newSnap = await getDoc(newRef);
    if (newSnap.exists()) {
      console.warn('Neuer Channel existiert schon:', newId);
      return;
    }

    const data = oldSnap.data();

    // 3) neues Channel-Dokument anlegen (ohne neues Feld!)
    await setDoc(newRef, {
      ...data,
    });

    // 4) Subcollections kopieren (members + messages)
    // members
    const oldMembers = await getDocs(collection(this.fs, `channels/${oldId}/members`));
    for (const m of oldMembers.docs) {
      await setDoc(doc(this.fs, `channels/${newId}/members/${m.id}`), m.data(), { merge: true });
    }

    // messages (kann groß werden!)
    const oldMessages = await getDocs(collection(this.fs, `channels/${oldId}/messages`));
    for (const msg of oldMessages.docs) {
      await setDoc(doc(this.fs, `channels/${newId}/messages/${msg.id}`), msg.data(), { merge: true });
    }

    // 5) altes löschen (erst subcollections, dann doc)
    // messages löschen
    for (const msg of oldMessages.docs) {
      await deleteDoc(doc(this.fs, `channels/${oldId}/messages/${msg.id}`));
    }
    // members löschen
    for (const m of oldMembers.docs) {
      await deleteDoc(doc(this.fs, `channels/${oldId}/members/${m.id}`));
    }

    await deleteDoc(oldRef);

    // 6) UI zur neuen Route
    this.router.navigate(['/channel', newId]);
  }

  async onLeaveChannel() {
    const channelId = this.route.snapshot.paramMap.get('id');
    if (!channelId) return;

    try {
      await this.chanSvc.leaveChannel(channelId);
      this.closeChannelInfoModal(); // Modal zu
      // optional: wohin navigieren, z.B. Home oder Login
      // this.router.navigate(['/new']);
    } catch (e) {
      console.error('Channel verlassen fehlgeschlagen:', e);
    }
  }

  openChannelInfoModal() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.editChannelName = id;
    this.editChannelDesc = this.channelTopic || '';

    this.channelNameEdit = false;
    this.channelDescEdit = false;
    this.channelInfoOpen = true;
  }

  closeChannelInfoModal() {
    this.channelInfoOpen = false;
    this.channelNameEdit = false;
    this.channelDescEdit = false;
  }

  async toggleChannelNameEdit() {
    if (!this.channelNameEdit) {
      this.channelNameEdit = true;
      return;
    }

    try {
      await this.authReady.requireUser();
      const oldId = this.route.snapshot.paramMap.get('id') ?? '';
      if (!oldId) return;

      await this.renameChannel(oldId, this.editChannelName);
      this.channelNameEdit = false;
    } catch (e) {
      console.error('Rename fehlgeschlagen:', e);
    }
  }

  async toggleChannelDescEdit() {
    if (!this.channelDescEdit) {
      this.channelDescEdit = true;
      return;
    }

    try {
      await this.authReady.requireUser();

      const channelId = this.route.snapshot.paramMap.get('id') ?? '';
      if (!channelId) return;

      await setDoc(
        doc(this.fs, `channels/${channelId}`),
        { topic: this.editChannelDesc.trim() },
        { merge: true }
      );

      this.channelDescEdit = false;
    } catch (e) {
      console.error('Topic speichern fehlgeschlagen:', e);
    }
  }

  // User-Profil Modal (für DMs)
  userProfileOpen = false;
  userProfile: { name: string; email?: string; avatarUrl: string; status?: string } | null = null;

  // Klick aus Mitglieder-Modal
  onMemberClick(userId: string) {
    this.closeMembersModal();
    this.openUserProfileModal(userId);
  }

  openUserProfileModal(userIdFromList?: string) {
    const id = userIdFromList ?? this.route.snapshot.paramMap.get('id');
    if (!id) return;

    const uref = doc(this.fs, `users/${id}`);

    runInInjectionContext(this.env, () =>
      docData(uref).pipe(take(1))
    ).subscribe((raw: any) => {
      if (!raw) return;

      this.userProfile = {
        name: raw.name ?? raw.displayName ?? 'Unbekannt',
        avatarUrl: this.fixAvatar(raw.avatarUrl),
        email: raw.email ?? '',
        status: raw.status ?? 'offline',
      };
      this.userProfileOpen = true;
    });
  }

  closeUserProfileModal() {
    this.userProfileOpen = false;
  }

  // Mitglieder-Modal
  membersModalOpen = false;

  openMembersModal(event?: MouseEvent) {
    event?.stopPropagation();
    this.membersModalOpen = true;

    const el = this.membersBtn?.nativeElement;
    if (el) this.positionModalFrom(el, 'members');
  }

  closeMembersModal() {
    this.membersModalOpen = false;
  }

  // Add-Members Modal
  addMembersOpen = false;
  addMemberName = '';
  addMemberInput = '';
  showAddMemberSuggest = false;
  addMemberSelected: UserMini | null = null;

  // interner Stream für das Suchfeld im Add-Members-Modal
  private addMemberInput$ = new BehaviorSubject<string>('');

  // Vorschlagsliste im Add-Members-Modal
  addMemberSuggestions$!: Observable<UserMini[]>;

  openAddMembersModal() {
    this.membersModalOpen = false;
    this.addMembersOpen = true;

    const el = this.addMembersBtn?.nativeElement;
    if (el) this.positionModalFrom(el, 'add');
  }

  closeAddMembersModal() {
    this.addMembersOpen = false;
    this.addMemberInput = '';
    this.addMemberSelected = null;
    this.addMemberInput$.next('');
  }

  async submitAddMember() {
    const selected = this.addMemberSelected;
    if (!selected) return;

    const channelId = this.route.snapshot.paramMap.get('id');
    if (!channelId) return;

    try {
      const mref = doc(this.fs, `channels/${channelId}/members/${selected.id}`);

      await setDoc(
        mref,
        {
          uid: selected.id,
          displayName: selected.name,
          avatarUrl: selected.avatarUrl,
          joinedAt: serverTimestamp(),
          role: 'member',
        },
        { merge: true }
      );

      this.closeAddMembersModal();
    } catch (err) {
      console.error('Fehler beim Hinzufügen des Members:', err);
    }
  }

  onAddMemberInput(value: string) {
    this.addMemberInput = value;
    this.addMemberSelected = null;
    this.addMemberInput$.next(value);
    this.showAddMemberSuggest = !!value.trim();
  }

  selectAddMember(u: UserMini) {
    this.addMemberSelected = u;
    this.addMemberInput = u.name;
    this.addMemberInput$.next(u.name);
    this.showAddMemberSuggest = false;
  }

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
  emojiContext: 'composer' | 'message' | 'edit' | null = null;

  emojiMessageTarget: MessageVm | null = null;

  // Header-Mitglieder (Channel)
  members$!: Observable<MemberVM[]>;
  trackMsg = (_: number, m: MessageVm) => m.id;
  trackMember = (_: number, m: MemberVM) => m.uid;

  channelsAll$!: Observable<{ id: string }[]>;
  usersAll$!: Observable<UserMini[]>;
  suggestions$!: Observable<SuggestItem[]>;
  composeTarget: SuggestItem | null = null;

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
    this.composeTarget = null;
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

  onSuggestionClick(ev: MouseEvent, s: SuggestItem) {
    ev.stopPropagation();
    this.pickSuggestion(s);
  }

  onToBlur() {
    setTimeout(() => {
      this.suggestOpen = false;
      this.suggestIndex = -1;
    }, 120);
  }

  pickSuggestion(s: SuggestItem) {
    this.to = s.value;
    this.toInput$.next(this.to);
    this.suggestOpen = false;
    this.suggestIndex = -1;
    this.composeTarget = s;
  }

  isOwnMessage(m: { authorId?: string } | null | undefined): boolean {
    const uid = this.currentUser?.id ?? this.auth.currentUser?.uid;
    return !!uid && String(m?.authorId ?? '') === String(uid);
  }

  closePopovers() {
    this.showEmoji = false;
    this.showMembers = false;
    this.messageEmojiForId = null;
    this.editMenuForId = null;
  }

  private normalize(s: string) {
    return (s || '').toLowerCase().trim();
  }

  constructor() {
    /** ---------- HEADER (VM) ---------- */
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
            (u: any): Vm => {
              const online =
                u?.online !== undefined
                  ? !!u.online
                  : u?.status === 'active';

              return {
                kind: 'dm',
                title: String(u?.name ?? ''),
                avatarUrl: u?.avatarUrl as string | undefined,
                online,
              };
            }
          ),
          startWith({
            kind: 'dm',
            title: '',
            avatarUrl: undefined,
            online: undefined,
          } as Vm)
        );
      })
    );

    this.vm$ = this.composeMode$.pipe(
      switchMap((isCompose) =>
        isCompose ? of<Vm>({ kind: 'channel', title: 'Neue Nachricht' }) : baseVm$
      )
    );

    this.composeMode$.subscribe((isCompose) => {
      this.composeMode = isCompose;
    });

    /** ---------- USERS (inkl. Online) ---------- */
    this.usersAll$ = runInInjectionContext(this.env, () =>
      collectionData(collection(this.fs, 'users'), { idField: 'id' })
    ).pipe(
      map((rows: any[]): UserMini[] =>
        (rows || []).map((u: any) => {
          const isOnline =
            u.online !== undefined ? !!u.online : u.status === 'active';

          return {
            id: u.id,
            name: u.name ?? u.displayName ?? 'Unbekannt',
            avatarUrl: this.fixAvatar(u.avatarUrl),
            online: isOnline,
          } as UserMini;
        })
      ),
      startWith([] as UserMini[])
    );

    /** ---------- MEMBERS (Header + Modal, nur Channel) ---------- */
    const channelMembersRaw$ = this.route.paramMap.pipe(
      map((params) => params.get('id')!),
      switchMap((id) => {
        if (!isPlatformBrowser(this.platformId)) return of([] as MemberDenorm[]);

        const ref = collection(this.fs, `channels/${id}/members`);
        const source$ = runInInjectionContext(this.env, () =>
          collectionData(ref, { idField: 'id' }) as Observable<any[]>
        );

        return source$.pipe(
          map((rows) => rows as MemberDenorm[]),
          startWith([] as MemberDenorm[])
        );
      })
    );

    this.members$ = combineLatest([channelMembersRaw$, this.usersAll$]).pipe(
      map(([members, users]) => {
        const userMap = new Map(users.map((u) => [u.id, u]));

        return members.map((m: any) => {
          const uid = m.uid || m.id;
          const u = userMap.get(uid);

          return <MemberVM>{
            uid,
            name: m.displayName ?? u?.name ?? 'Member',
            avatarUrl: this.fixAvatar(m.avatarUrl ?? u?.avatarUrl),
            online: u?.online ?? false,
          };
        });
      }),
      startWith([] as MemberVM[])
    );

    // "Leute hinzufügen"-Modal
    this.addMemberSuggestions$ = combineLatest([
      this.addMemberInput$.pipe(startWith('')),
      this.usersAll$,
      this.members$.pipe(startWith([] as MemberVM[])),
    ]).pipe(
      map(([query, users, members]) => {
        const q = (query || '').trim().toLowerCase();
        if (!q) return [];

        // bestehende Channel-Mitglieder herausfiltern
        const memberIds = new Set(members.map(m => m.uid));

        return users
          .filter(u => !memberIds.has(u.id))
          .filter(u => u.name.toLowerCase().includes(q))
          .slice(0, 8);
      })
    );

    /** ---------- NACHRICHTEN ---------- */
    const baseMessages$ = combineLatest([
      this.route.paramMap.pipe(map(p => p.get('id')!)),
      this.me$,
      this.usersAll$,
    ]).pipe(
      switchMap(([id, me, users]) => {
        const userMap = new Map(users.map(u => [u.id, u]));
        const isDM = this.router.url.includes('/dm/');
        if (!isPlatformBrowser(this.platformId)) return of([] as MessageVm[]);

        // Channel
        if (!isDM) {
          const collRef = collection(this.fs, `channels/${id}/messages`);
          const qRef = query(collRef, orderBy('createdAt', 'asc'));
          return runInInjectionContext(this.env, () =>
            collectionData(qRef, { idField: 'id' }) as Observable<any[]>
          ).pipe(
            map(rows =>
              rows.map(m => {
                const u = userMap.get(m.authorId ?? '');
                return ({
                  id: m.id,
                  text: m.text ?? '',
                  authorId: m.authorId ?? '',
                  authorName: u?.name ?? m.authorName ?? 'Unbekannt',
                  authorAvatar: u?.avatarUrl ?? m.authorAvatar ?? '/public/images/avatars/avatar-default.svg',
                  createdAt: toDateMaybe(m.createdAt),
                  replyCount: (m.replyCount ?? 0),
                  lastReplyAt: toDateMaybe(m.lastReplyAt),
                  reactions: m.reactions ?? {},
                  reactionBy: m.reactionBy ?? {},
                } as MessageVm);
              })
            ),
            startWith([] as MessageVm[])
          );
        }

        // DM
        if (!me) return of([] as MessageVm[]);

        const convId = this.makeConvId(me.uid, id);
        const collRef = collection(this.fs, `conversations/${convId}/messages`);
        const qRef = query(collRef, orderBy('createdAt', 'asc'));

        return runInInjectionContext(this.env, () =>
          collectionData(qRef, { idField: 'id' }) as Observable<any[]>
        ).pipe(
          map(rows =>
            rows.map(m => ({
              id: m.id,
              text: m.text ?? '',
              authorId: m.authorId ?? '',
              authorName: m.authorName ?? 'Unbekannt',
              authorAvatar: m.authorAvatar ?? '/public/images/avatars/avatar-default.svg',
              createdAt: toDateMaybe(m.createdAt),
              replyCount: (m.replyCount ?? 0),
              lastReplyAt: toDateMaybe(m.lastReplyAt),
              reactions: m.reactions ?? {},
              reactionBy: m.reactionBy ?? {},
            } as MessageVm))
          ),
          startWith([] as MessageVm[])
        );
      })
    );

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

          const key = `${d.getFullYear()}-${String(
            d.getMonth() + 1
          ).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(m);
        }

        const groups: DayGroup[] = [...buckets.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, items]) => {
            items.sort(
              (a, b) => a.createdAt!.getTime() - b.createdAt!.getTime()
            );

            const [y, mo, da] = key.split('-').map(Number);
            const date = new Date(y, mo - 1, da);
            const isToday = sameYMD(date, today);

            return {
              label: isToday ? 'Heute' : dayLabel(date),
              isToday,
              items,
            } as DayGroup;
          });

        return groups;
      })
    );

    /** ---------- LEER/AKTIV ---------- */
    const channelId$ = this.route.paramMap.pipe(map((p) => p.get('id')!));

    this.channelDoc$ = channelId$.pipe(
      switchMap((id) => {
        if (!isPlatformBrowser(this.platformId)) return of<ChannelDoc | null>(null);

        return (docData(doc(this.fs, `channels/${id}`)) as Observable<any>).pipe(
          map(data => (data ? ({ id, ...data } as ChannelDoc) : null)),
          catchError(() => of<ChannelDoc | null>(null))
        );
      }),
      startWith<ChannelDoc | null>(null)
    );

    this.channelCreator$ = this.channelDoc$.pipe(
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

    // Topic in lokale Variable spiegeln (für Modal & Editfeld)
    this.channelDoc$.subscribe((ch) => {
      this.channelTopic = ch?.topic ?? '';
    });

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

    const baseIsEmpty$ = combineLatest([this.channelDoc$, firstMessage$]).pipe(
      map(([ch, first]) =>
        (ch?.messageCount ?? 0) === 0 && (first?.length ?? 0) === 0
      )
    );

    this.isEmpty$ = this.composeMode$.pipe(
      switchMap((isCompose) => (isCompose ? of(true) : baseIsEmpty$))
    );

    /** ---------- Channels + Users (für Autocomplete) ---------- */
    this.channelsAll$ = runInInjectionContext(this.env, () =>
      collectionData(collection(this.fs, 'channels'), { idField: 'id' })
    ).pipe(
      map((rows: any[]) =>
        (rows || [])
          .map((r: any) => ({ id: String(r?.id || '') }))
          .filter((x) => !!x.id)
      ),
      startWith([])
    );

    // suggestions$ nutzt dieselben usersAll$
    this.suggestions$ = combineLatest([
      this.toInput$.pipe(startWith('')),
      this.channelsAll$,
      this.usersAll$,
    ]).pipe(
      map(([raw, channels, users]) => {
        const q = this.normalize(raw);
        if (!q) return [] as SuggestItem[];

        // Basis-Suchterm: ohne #/@ am Anfang
        const term =
          q.startsWith('#') || q.startsWith('@')
            ? this.normalize(q.slice(1))
            : q;

        // #channel → nur Channels filtern
        if (q.startsWith('#')) {
          return channels
            .filter(c => this.normalize(c.id).includes(term))
            .slice(0, 8)
            .map<SuggestItem>(c => ({
              kind: 'channel',
              id: c.id,
              label: `# ${c.id}`,
              value: `#${c.id}`,
            }));
        }

        // @user → nur User filtern
        if (q.startsWith('@')) {
          return users
            .filter(u => this.normalize(u.name).includes(term))
            .slice(0, 8)
            .map<SuggestItem>(u => ({
              kind: 'user',
              id: u.id,
              label: `@${u.name}`,
              value: `@${u.name}`,
              avatarUrl: u.avatarUrl,
            }));
        }

        // sonst: Channels + User gemischt, beide nach term filtern
        const channelMatches = channels
          .filter(c => this.normalize(c.id).includes(term))
          .slice(0, 4)
          .map<SuggestItem>(c => ({
            kind: 'channel',
            id: c.id,
            label: `# ${c.id}`,
            value: `#${c.id}`,
          }));

        const userMatches = users
          .filter(u => this.normalize(u.name).includes(term))
          .slice(0, 4)
          .map<SuggestItem>(u => ({
            kind: 'user',
            id: u.id,
            label: `@${u.name}`,
            value: `@${u.name}`,
            avatarUrl: u.avatarUrl,
          }));

        return [...channelMatches, ...userMatches];
      })
    );

    /** ---------- aktueller User ---------- */
    authState(this.auth)
      .pipe(
        switchMap((user) => {
          if (!user) return of(null);

          const uref = doc(this.fs, `users/${user.uid}`);
          return docData(uref).pipe(
            map((raw) => {
              const data = (raw || {}) as any;
              return {
                id: user.uid,
                name:
                  data.name ??
                  data.displayName ??
                  user.displayName ??
                  user.email ??
                  'Guest',
                avatarUrl:
                  data.avatarUrl ??
                  '/public/images/avatars/avatar-default.svg',
                ...data,
              } as UserDoc & { id: string };
            })
          );
        })
      )
      .subscribe((u) => {
        this.currentUser = u;
      });

    this.usersAll$.subscribe(users => {
      this.userNameMap = new Map(users.map(u => [u.id, u.name]));
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
    const native =
      e?.emoji?.native ??
      e?.emoji?.char ??
      e?.native ??
      e?.colons ??
      '';

    if (this.emojiContext === 'message' && this.emojiMessageTarget) {
      this.addReactionToMessage(this.emojiMessageTarget, native);

      this.messageEmojiForId = null;
      this.emojiContext = null;
      this.emojiMessageTarget = null;
      return;
    }

    // Edit-Mode: Emoji in editDraft einfügen
    if (this.emojiContext === 'edit') {
      this.editDraft = (this.editDraft || '') + native;

      // optional: Picker schließen wie beim Composer
      this.showEmoji = false;
      this.emojiContext = null;
      return;
    }

    this.draft += native;
    this.closeEmoji();
  }

  // UI-Stub für Reaktionen – hier kannst du später Firestore-Update einbauen
  private async addReactionToMessage(msg: MessageVm, emoji: string) {
    try {
      const id = this.route.snapshot.paramMap.get('id')!;
      const isDM = this.router.url.includes('/dm/');
      const authUser = await this.authReady.requireUser();

      const uid = authUser.uid;
      const key = String(emoji);

      const ref = !isDM
        ? doc(this.fs, `channels/${id}/messages/${msg.id}`)
        : doc(this.fs, `conversations/${this.makeConvId(uid, id)}/messages/${msg.id}`);

      await runTransaction(this.fs, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;

        const data = snap.data() as any;

        const already = !!data?.reactionBy?.[key]?.[uid];
        const currentCount = Number(data?.reactions?.[key] ?? 0);

        const displayName =
          this.currentUser?.name ??
          authUser.displayName ??
          authUser.email ??
          'Unbekannt';

        if (already) {
          const updatePayload: any = {
            [`reactionBy.${key}.${uid}`]: deleteField(),
          };

          if (currentCount <= 1) {
            updatePayload[`reactions.${key}`] = deleteField();
          } else {
            updatePayload[`reactions.${key}`] = increment(-1);
          }

          tx.update(ref, updatePayload);
          return;
        }

        tx.update(ref, {
          [`reactionBy.${key}.${uid}`]: true,
          [`reactions.${key}`]: increment(1),
        });
      });

    } catch (e) {
      console.error('[Chat] Reaction update failed:', e);
    }
  }

  onReactionChipClick(ev: MouseEvent, m: MessageVm, emoji: string) {
    ev.stopPropagation();
    this.addReactionToMessage(m, emoji);
  }

  onEmojiClick(event: any) {
    const emoji =
      event?.detail?.unicode || event?.detail?.emoji?.unicode || '';
    this.draft += emoji;
  }

  toggleMembers(evt?: Event) {
    evt?.stopPropagation();

    if (this.composeMode) {
      this.openToSuggestWithAt();
      return;
    }

    const next = !this.showMembers;
    this.showMembers = next;
    if (next) this.showEmoji = false;
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

  openThread(m: any, vm: any) {
    const channelId = this.route.snapshot.paramMap.get('id');
    if (!channelId) return;

    this.thread.openThread({
      channelId,
      header: { title: 'Thread', channel: vm.title },
      root: {
        id: m.id,
        author: {
          id: m.authorId ?? '',
          name: m.authorName,
          avatarUrl: m.authorAvatar,
        },
        text: m.text,
        createdAt: m.createdAt ?? new Date(),
      },
    });
  }

  private openToSuggestWithAt() {
    this.to = '@';
    this.toInput$.next(this.to);
    this.suggestOpen = true;
    this.suggestIndex = -1;
    this.composeTarget = null;

    // Input fokussieren (nach dem nächsten Change Detection Tick)
    setTimeout(() => {
      this.toInputEl?.nativeElement.focus();
    });
  }

  private lockBodyScroll(locked: boolean) {
    if (!isPlatformBrowser(this.platformId)) return;
    document.body.style.overflow = locked ? 'hidden' : '';
  }

  openEmojiForComposer(ev: MouseEvent) {
    ev.stopPropagation();

    // Toggle: wenn Composer-Emoji schon offen ist -> schließen
    if (this.showEmoji && this.emojiContext === 'composer') {
      this.showEmoji = false;
      this.emojiContext = null;
      return;
    }

    const btn = ev.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();

    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const viewportW = window.innerWidth || document.documentElement.clientWidth;

    const pickerWidth = 360;
    const estimatedHeight = 360;
    const offset = 10;

    let left = Math.max(10, Math.min(rect.left, viewportW - pickerWidth - 10));
    let top = rect.top - estimatedHeight - offset;

    this.composerEmojiPos = { top, left };

    // Kontext setzen + andere Popover schließen
    this.emojiContext = 'composer';
    this.emojiMessageTarget = null;
    this.showEmoji = true;
    this.showMembers = false;

    // nach Render: echte Höhe messen und neu setzen
    requestAnimationFrame(() => {
      const el = document.querySelector('.composer-emoji-popover-fixed') as HTMLElement | null;
      if (!el) return;

      const realH = el.offsetHeight || estimatedHeight;
      const roomBelow = viewportH - rect.bottom;
      const placeAbove = roomBelow < realH + offset;

      let finalTop = placeAbove ? rect.top - realH - offset : rect.bottom + offset;
      finalTop = Math.max(10, Math.min(finalTop, viewportH - realH - 10));

      this.composerEmojiPos = { top: finalTop, left };
    });
  }

  toggleMessageEmojiPicker(ev: MouseEvent, msg: MessageVm, from: 'actions' | 'reactions' = 'reactions') {
    ev.stopPropagation();

    if (this.messageEmojiForId === msg.id) {
      this.closeMessageEmojiPopover();
      return;
    }

    this.emojiOpenedFrom = from;

    const btn = ev.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();

    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const viewportW = window.innerWidth || document.documentElement.clientWidth;

    const pickerHeight = 360;
    const pickerWidth = 360;
    const offset = 8;

    const roomBelow = viewportH - rect.bottom;
    const placement: 'top' | 'bottom' =
      roomBelow > pickerHeight + offset ? 'bottom' : 'top';

    let top = placement === 'bottom' ? rect.bottom + offset : rect.top - pickerHeight - offset;

    let left = rect.left;
    const maxLeft = viewportW - pickerWidth - 16;
    if (left > maxLeft) left = Math.max(16, maxLeft);

    this.messageEmojiForId = msg.id;
    this.emojiPopoverPos = { top, left, placement };

    this.emojiContext = 'message';
    this.emojiMessageTarget = msg;
  }

  private closeMessageEmojiPopover() {
    this.messageEmojiForId = null;
    this.emojiContext = null;
    this.emojiMessageTarget = null;
    this.emojiOpenedFrom = null;
  }

  async send(vm: Vm) {
    const msg = this.draft.trim();
    if (!msg) return;

    const id = this.route.snapshot.paramMap.get('id')!;
    const isDM = vm.kind === 'dm';

    const authUser = await this.authReady.requireUser();

    const u = this.currentUser;

    const guestEmail = 'guest@dabubble.de';
    const isGuest = u?.role === 'guest' || authUser.email === guestEmail;

    const authorId = authUser.uid;
    const authorName = isGuest
      ? 'Guest'
      : u?.name ??
      (u as any)?.displayName ??
      authUser.displayName ??
      authUser.email ??
      'Unbekannt';

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

  async sendFromCompose() {
    const target = this.composeTarget;
    const text = this.draft.trim();

    if (!target) {
      return;
    }

    const authUser = await this.authReady.requireUser();

    const u = this.currentUser;
    const guestEmail = 'guest@dabubble.de';
    const isGuest = u?.role === 'guest' || authUser.email === guestEmail;

    const authorId = authUser.uid;
    const authorName = isGuest
      ? 'Guest'
      : u?.name ??
      (u as any)?.displayName ??
      authUser.displayName ??
      authUser.email ??
      'Unbekannt';

    const authorAvatar = u?.avatarUrl ?? '/public/images/avatars/avatar-default.svg';

    try {
      // === CHANNEL als Ziel ===
      if (target.kind === 'channel' && target.id) {
        const channelId = target.id;

        if (text) {
          const coll = collection(this.fs, `channels/${channelId}/messages`);
          await addDoc(coll, {
            text,
            authorId,
            authorName,
            authorAvatar,
            createdAt: serverTimestamp(),
            replyCount: 0,
            reactions: {},
          });
        }

        // Eingaben zurücksetzen
        this.draft = '';
        this.to = '';
        this.composeTarget = null;
        this.showEmoji = false;

        // zum Channel navigieren
        this.router.navigate(['/channel', channelId]);
        return;
      }

      // === USER / DM als Ziel ===
      if (target.kind === 'user' && target.id) {
        const otherUserId = target.id;
        const convId = this.makeConvId(authorId, otherUserId);

        if (text) {
          const coll = collection(this.fs, `conversations/${convId}/messages`);
          await addDoc(coll, {
            text,
            authorId,
            authorName,
            authorAvatar,
            createdAt: serverTimestamp(),
          });
        }

        this.draft = '';
        this.to = '';
        this.composeTarget = null;
        this.showEmoji = false;

        this.router.navigate(['/dm', otherUserId]);
        return;
      }

      // === E-Mail als Ziel === (einfaches mailto, optional)
      if (target.kind === 'email') {
        if (isPlatformBrowser(this.platformId)) {
          const body = text ? `?body=${encodeURIComponent(text)}` : '';
          window.location.href = `mailto:${target.value}${body}`;
        }
        this.draft = '';
        this.to = '';
        this.composeTarget = null;
        this.showEmoji = false;
      }
    } catch (err) {
      console.error('Fehler beim Senden aus /new:', err);
    }
  }

  hasReactions(m: MessageVm): boolean {
    const r = (m as any)?.reactions || {};
    return Object.keys(r).length > 0;
  }

  reactionList(m: MessageVm): Array<{ emoji: string; count: number }> {
    const r = ((m as any)?.reactions || {}) as Record<string, number>;
    return Object.entries(r)
      .map(([emoji, count]) => ({ emoji, count: Number(count || 0) }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  trackReaction = (_: number, r: { emoji: string; count: number }) => r.emoji;
  private asEmojiString(e: any): string {
    return (
      e?.emoji?.native ??
      e?.native ??
      e?.emoji?.char ??
      e?.char ??
      (typeof e === 'string' ? e : '')
    );
  }

  hasUserReacted(m: MessageVm, emoji: string, uid: string): boolean {
    const by = (m as any)?.reactionBy || {};
    return !!by?.[emoji]?.[uid];
  }

  hoveredReaction: { msgId: string; emoji: string } | null = null;

  onReactionHover(m: MessageVm | null, emoji?: string) {
    if (!m || !emoji) {
      this.hoveredReaction = null;
      return;
    }
    this.hoveredReaction = { msgId: m.id, emoji };
  }

  isReactionHovered(m: MessageVm, emoji: string): boolean {
    return !!this.hoveredReaction
      && this.hoveredReaction.msgId === m.id
      && this.hoveredReaction.emoji === emoji;
  }

  reactionNames(m: MessageVm, emoji: string): string[] {
    const by = ((m as any)?.reactionBy?.[emoji] || {}) as Record<string, any>;
    const myUid = this.currentUser?.id ?? this.auth.currentUser?.uid ?? '';

    const names = Object.keys(by)
      .filter(uid => !!by[uid])
      .map(uid => {
        if (myUid && uid === myUid) return 'Du';
        return this.userNameMap.get(uid) ?? 'Unbekannt';
      });

    return names.length ? names : ['Unbekannt'];
  }

  reactionVerb(m: MessageVm, emoji: string): string {
    const names = this.reactionNames(m, emoji);

    const includesYou = names.includes('Du');

    if (includesYou && names.length === 1) return 'hast reagiert';

    return names.length === 1 ? 'hat reagiert' : 'haben reagiert';
  }

  openEmojiForEdit(ev: MouseEvent) {
    ev.stopPropagation();

    // Toggle: wenn Edit-Emoji schon offen ist -> schließen
    if (this.showEmoji && this.emojiContext === 'edit') {
      this.showEmoji = false;
      this.emojiContext = null;
      return;
    }

    const btn = ev.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();

    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const viewportW = window.innerWidth || document.documentElement.clientWidth;

    const pickerWidth = 360;
    const estimatedHeight = 360;
    const offset = 10;

    let left = Math.max(10, Math.min(rect.left, viewportW - pickerWidth - 10));
    let top = rect.top - estimatedHeight - offset;

    this.composerEmojiPos = { top, left };

    // Kontext setzen + andere Popover schließen
    this.emojiContext = 'edit';
    this.emojiMessageTarget = null;
    this.showEmoji = true;
    this.showMembers = false;
    this.messageEmojiForId = null;

    requestAnimationFrame(() => {
      const el = document.querySelector('.composer-emoji-popover-fixed') as HTMLElement | null;
      if (!el) return;

      const realH = el.offsetHeight || estimatedHeight;
      const roomBelow = viewportH - rect.bottom;
      const placeAbove = roomBelow < realH + offset;

      let finalTop = placeAbove ? rect.top - realH - offset : rect.bottom + offset;
      finalTop = Math.max(10, Math.min(finalTop, viewportH - realH - 10));

      this.composerEmojiPos = { top: finalTop, left };
    });
  }
}
