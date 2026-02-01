import { Component, ElementRef, EnvironmentInjector, HostListener, PLATFORM_ID, ViewChild, inject, runInInjectionContext, } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, docData, collection, collectionData, query, orderBy, serverTimestamp, setDoc, getDoc } from '@angular/fire/firestore';
import { Observable, of, combineLatest, BehaviorSubject } from 'rxjs';
import { map, switchMap, startWith, take, filter } from 'rxjs/operators';
import { ChannelDoc, DayGroup, MemberDenorm, MemberVM, MessageVm, SuggestItem, UserDoc, Vm, UserMini, } from '../interfaces/allInterfaces.interface';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { ThreadState } from '../services/thread.state';
import { Auth, authState } from '@angular/fire/auth';
import { AuthReadyService } from '../services/auth-ready.service';
import { ChatRefreshService } from '../services/chat-refresh.service';
import { ChatUiStateHelper } from './chat-ui-state.helper';
import { ChatMessageHelper } from './chat-message.helper';
import { ChatEmojiHelper } from './chat-emoji.helper';
import { ChatModalHelper } from './chat-modal.helper';
import { ChatComposerHelper } from './chat-composer.helper';

/** Converts Firestore timestamp to Date or null */
function toDateMaybe(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts?.toDate === 'function') return ts.toDate();
  if (ts instanceof Date) return ts;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}
/** Checks if two dates are on the same day */
function sameYMD(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/** Formats a date as German day label */
function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }).format(d).replace(/\./g, '').replace(/\s+/g, ' ');
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  providers: [ChatUiStateHelper, ChatMessageHelper, ChatEmojiHelper, ChatModalHelper, ChatComposerHelper]
})
export class ChatComponent {
  private authReady = inject(AuthReadyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fs = inject(Firestore);
  private env = inject(EnvironmentInjector);
  private platformId = inject(PLATFORM_ID);
  private chatRefresh = inject(ChatRefreshService);
  private auth = inject(Auth);
  private thread = inject(ThreadState);
  public ui = inject(ChatUiStateHelper);
  public messageHelper = inject(ChatMessageHelper);
  public emoji = inject(ChatEmojiHelper);
  public modal = inject(ChatModalHelper);
  public composer = inject(ChatComposerHelper);

  @ViewChild('toInputEl') toInputEl!: ElementRef<HTMLInputElement>;
  @ViewChild('membersBtn') membersBtn?: ElementRef<HTMLElement>;
  @ViewChild('addMembersBtn') addMembersBtn?: ElementRef<HTMLElement>;
  @ViewChild('msgEmojiPopover') msgEmojiPopover?: ElementRef<HTMLElement>;

  currentUser: (UserDoc & { id: string }) | null = null;
  composeMode = false;
  private userNameMap = new Map<string, string>();
  get to() { return this.composer.to; }
  set to(v: string) { this.composer.to = v; }
  get draft() { return this.composer.draft; }
  set draft(v: string) { this.composer.draft = v; }
  get suggestOpen() { return this.composer.suggestOpen; }
  set suggestOpen(v: boolean) { this.composer.suggestOpen = v; }
  get suggestIndex() { return this.composer.suggestIndex; }
  set suggestIndex(v: number) { this.composer.suggestIndex = v; }
  get showEmoji() { return this.ui.showEmoji; }
  set showEmoji(v: boolean) { this.ui.showEmoji = v; }
  get showMembers() { return this.ui.showMembers; }
  set showMembers(v: boolean) { this.ui.showMembers = v; }
  get composerEmojiPos() { return this.ui.composerEmojiPos; }
  get editingMessageId() { return this.ui.editingMessageId; }
  get messageEmojiForId() { return this.ui.messageEmojiForId; }
  get emojiPopoverPos() { return this.ui.emojiPopoverPos; }
  get editMenuForId() { return this.ui.editMenuForId; }
  get editMenuPos() { return this.ui.editMenuPos; }
  get editDraft() { return this.ui.editDraft; }
  set editDraft(v: string) { this.ui.editDraft = v; }
  get channelInfoOpen() { return this.ui.channelInfoOpen; }
  get channelNameEdit() { return this.ui.channelNameEdit; }
  get editChannelName() { return this.ui.editChannelName; }
  set editChannelName(v: string) { this.ui.editChannelName = v; }
  get channelDescEdit() { return this.ui.channelDescEdit; }
  get editChannelDesc() { return this.ui.editChannelDesc; }
  set editChannelDesc(v: string) { this.ui.editChannelDesc = v; }
  get channelTopic() { return this.ui.channelTopic; }
  get userProfileOpen() { return this.ui.userProfileOpen; }
  get userProfile() { return this.ui.userProfile; }
  get membersModalOpen() { return this.ui.membersModalOpen; }
  get membersModalPos() { return this.ui.membersModalPos; }
  get addMembersOpen() { return this.ui.addMembersOpen; }
  get addMembersModalPos() { return this.ui.addMembersModalPos; }
  get addMemberInput() { return this.ui.addMemberInput; }
  set addMemberInput(v: string) { this.ui.addMemberInput = v; }
  get showAddMemberSuggest() { return this.ui.showAddMemberSuggest; }
  get addMemberSelected() { return this.ui.addMemberName.trim().length > 0; }
  vm$!: Observable<Vm>;
  composeMode$!: Observable<boolean>;
  channelDoc$!: Observable<ChannelDoc | null>;
  channelCreator$!: Observable<UserDoc | null>;
  usersAll$!: Observable<UserMini[]>;
  members$!: Observable<MemberVM[]>;
  suggestions$!: Observable<SuggestItem[]>;
  channelsAll$!: Observable<{ id: string; name: string }[]>;
  messages$!: Observable<MessageVm[]>;
  groups$!: Observable<DayGroup[]>;
  isEmpty$!: Observable<boolean>;
  addMemberSuggestions$!: Observable<UserMini[]>;
  composeTarget: any = null;
  toInput$ = new BehaviorSubject<string>('');
  emojiContext: 'composer' | 'edit' | 'message' | null = null;
  emojiMessageTarget: any = null;

  constructor() {
    this.initializeObservables();
    this.setupUserTracking();
    this.setupThreadRouting();
  }

  /** Initializes all observables for data streams */
  private initializeObservables() {
    this.composeMode$ = this.route.url.pipe(map(seg => seg.some(s => s.path === 'new')));
    this.composeMode$.subscribe(mode => this.composeMode = mode);
    const isDM$ = this.route.url.pipe(map(() => this.router.url.includes('/dm/')));
    const routeId$ = this.route.paramMap.pipe(map(p => p.get('id')!));
    const baseVm$ = combineLatest([routeId$, isDM$]).pipe(switchMap(([id, isDM]) => {
      if (!isPlatformBrowser(this.platformId)) return of<Vm>(isDM ? { kind: 'dm', title: '' } : { kind: 'channel', title: `# ${id}` });
      if (!isDM) return runInInjectionContext(this.env, () => docData(doc(this.fs, `channels/${id}`))).pipe(map((ch: any): Vm => ({ kind: 'channel', title: `# ${ch?.name ?? id}` })), startWith({ kind: 'channel', title: `# ${id}` } as Vm));
      return runInInjectionContext(this.env, () => docData(doc(this.fs, `users/${id}`))).pipe(map((u: any): Vm => ({ kind: 'dm', title: u?.name ?? '', avatarUrl: u?.avatarUrl, online: u?.online ?? u?.status === 'active' })), startWith({ kind: 'dm', title: '' } as Vm));
    }));
    this.vm$ = this.composeMode$.pipe(switchMap(c => c ? of<Vm>({ kind: 'channel', title: 'Neue Nachricht' }) : baseVm$));
    this.usersAll$ = runInInjectionContext(this.env, () => collectionData(collection(this.fs, 'users'), { idField: 'id' })).pipe(map((r: any[]): UserMini[] => (r || []).map(u => ({ id: u.id, name: u.name ?? u.displayName ?? 'Unbekannt', avatarUrl: this.fixAvatar(u.avatarUrl), online: u.online ?? u.status === 'active' }))), startWith([]));
    const memRaw$ = routeId$.pipe(switchMap(id => {
      if (!isPlatformBrowser(this.platformId)) return of([]);
      return runInInjectionContext(this.env, () => collectionData(collection(this.fs, `channels/${id}/members`), { idField: 'id' }) as Observable<any[]>).pipe(startWith([]));
    }));
    this.members$ = combineLatest([memRaw$, this.usersAll$]).pipe(map(([mem, usr]) => {
      const uMap = new Map(usr.map(u => [u.id, u]));
      return mem.map((m: any) => {
        const uid = m.uid || m.id;
        const u = uMap.get(uid);
        return { uid, name: m.displayName ?? u?.name ?? 'Member', avatarUrl: this.fixAvatar(m.avatarUrl ?? u?.avatarUrl), online: u?.online ?? false };
      });
    }), startWith([]));
    this.addMemberSuggestions$ = combineLatest([this.composer.addMemberInput$.pipe(startWith('')), this.usersAll$, this.members$]).pipe(map(([q, usr, mem]) => {
      const term = (q || '').trim().toLowerCase();
      if (!term) return [];
      const mIds = new Set(mem.map(m => m.uid));
      return usr.filter(u => !mIds.has(u.id) && u.name.toLowerCase().includes(term)).slice(0, 8);
    }));
    this.channelDoc$ = routeId$.pipe(switchMap(id => {
      if (!isPlatformBrowser(this.platformId) || this.router.url.includes('/dm/') || this.router.url.includes('/new')) return of(null);
      return runInInjectionContext(this.env, () => docData(doc(this.fs, `channels/${id}`)) as Observable<any>).pipe(map(r => r ? { id, name: r.name ?? '', topic: r.topic ?? '', createdBy: r.createdBy ?? '', createdAt: r.createdAt, memberCount: r.memberCount ?? 0, messageCount: r.messageCount ?? 0 } : null), startWith(null));
    }));
    this.channelCreator$ = this.channelDoc$.pipe(switchMap(ch => {
      if (!ch?.createdBy) return of(null);
      return runInInjectionContext(this.env, () => docData(doc(this.fs, `users/${ch.createdBy}`)) as Observable<any>).pipe(map(u => u ? { id: ch.createdBy, name: u.name ?? 'Unbekannt', email: u.email, avatarUrl: u.avatarUrl, status: u.status, role: u.role } : null));
    }));
    this.messages$ = combineLatest([routeId$, authState(this.auth).pipe(startWith(this.auth.currentUser)), this.usersAll$, this.chatRefresh.refreshTrigger$]).pipe(switchMap(([id, me, usr]) => {
      const uMap = new Map(usr.map(u => [u.id, u]));
      const isDM = this.router.url.includes('/dm/');
      if (!isPlatformBrowser(this.platformId)) return of([]);
      if (!isDM) {
        const qRef = query(collection(this.fs, `channels/${id}/messages`), orderBy('createdAt', 'asc'));
        return runInInjectionContext(this.env, () => collectionData(qRef, { idField: 'id' }) as Observable<any[]>).pipe(map(rows => rows.map(m => {
          const u = uMap.get(m.authorId ?? '');
          return { id: m.id, text: m.text ?? '', authorId: m.authorId ?? '', authorName: u?.name ?? m.authorName ?? 'Unbekannt', authorAvatar: u?.avatarUrl ?? m.authorAvatar ?? '/public/images/avatars/avatar-default.svg', createdAt: toDateMaybe(m.createdAt), replyCount: m.replyCount ?? 0, lastReplyAt: toDateMaybe(m.lastReplyAt), reactions: m.reactions ?? {}, reactionBy: m.reactionBy ?? {} };
        })), startWith([]));
      }
      if (!me) return of([]);
      const convId = this.makeConvId(me.uid, id);
      const qRef = query(collection(this.fs, `conversations/${convId}/messages`), orderBy('createdAt', 'asc'));
      return runInInjectionContext(this.env, () => collectionData(qRef, { idField: 'id' }) as Observable<any[]>).pipe(map(rows => rows.map(m => ({ id: m.id, text: m.text ?? '', authorId: m.authorId ?? '', authorName: m.authorName ?? 'Unbekannt', authorAvatar: m.authorAvatar ?? '/public/images/avatars/avatar-default.svg', createdAt: toDateMaybe(m.createdAt), replyCount: 0, lastReplyAt: null, reactions: m.reactions ?? {}, reactionBy: m.reactionBy ?? {} }))), startWith([]));
    }));
    this.groups$ = this.messages$.pipe(map(msgs => {
      if (!msgs.length) return [];
      const grps: DayGroup[] = [];
      let cur: DayGroup | null = null;
      let curDate: Date | null = null;
      for (const m of msgs) {
        const d = m.createdAt;
        if (!d) continue;
        if (!curDate || !sameYMD(curDate, d)) {
          curDate = d;
          const today = new Date();
          cur = { label: dayLabel(d), isToday: sameYMD(d, today), items: [] };
          grps.push(cur);
        }
        cur!.items.push(m);
      }
      return grps;
    }));
    const firstMsg$ = routeId$.pipe(switchMap(id => {
      if (!isPlatformBrowser(this.platformId) || this.router.url.includes('/dm/')) return of([]);
      return runInInjectionContext(this.env, () => collectionData(query(collection(this.fs, `channels/${id}/messages`), orderBy('createdAt', 'asc')), { idField: 'id' }) as Observable<any[]>).pipe(startWith([]));
    }));
    this.isEmpty$ = this.composeMode$.pipe(switchMap(c => c ? of(true) : combineLatest([this.channelDoc$, firstMsg$]).pipe(map(([ch, first]) => (ch?.messageCount ?? 0) === 0 && (first?.length ?? 0) === 0))));
    this.channelsAll$ = runInInjectionContext(this.env, () => collectionData(collection(this.fs, 'channels'), { idField: 'id' })).pipe(map((r: any[]) => (r || []).map(x => ({ id: String(x?.id || ''), name: String(x?.name ?? '').trim() })).filter(x => x.id && x.name)), startWith([]));
    this.suggestions$ = combineLatest([this.toInput$.pipe(startWith('')), this.channelsAll$, this.usersAll$]).pipe(map(([raw, chs, usr]) => {
      const q = (raw || '').toLowerCase().trim();
      if (!q) return [];
      const term = q.startsWith('#') || q.startsWith('@') ? q.slice(1).toLowerCase().trim() : q;
      if (q.startsWith('#')) return chs.filter(c => c.name.toLowerCase().includes(term)).slice(0, 8).map<SuggestItem>(c => ({ kind: 'channel', id: c.id, label: `# ${c.name}`, value: `#${c.name}` }));
      if (q.startsWith('@')) return usr.filter(u => u.name.toLowerCase().includes(term)).slice(0, 8).map<SuggestItem>(u => ({ kind: 'user', id: u.id, label: `@${u.name}`, value: `@${u.name}`, avatarUrl: u.avatarUrl }));
      return [...chs.filter(c => c.name.toLowerCase().includes(term)).slice(0, 4).map<SuggestItem>(c => ({ kind: 'channel', id: c.id, label: `# ${c.name}`, value: `#${c.name}` })), ...usr.filter(u => u.name.toLowerCase().includes(term)).slice(0, 4).map<SuggestItem>(u => ({ kind: 'user', id: u.id, label: `@${u.name}`, value: `@${u.name}`, avatarUrl: u.avatarUrl }))];
    }));
  }

  /** Sets up user authentication and name tracking */
  private setupUserTracking() {
    authState(this.auth).pipe(switchMap(user => {
      if (!user) return of(null);
      return docData(doc(this.fs, `users/${user.uid}`)).pipe(map((raw: any) => {
        const data = raw || {};
        return { id: user.uid, name: data.name ?? data.displayName ?? user.displayName ?? user.email ?? 'Guest', avatarUrl: data.avatarUrl ?? '/public/images/avatars/avatar-default.svg', ...data };
      }));
    })).subscribe(u => this.currentUser = u);
    this.usersAll$.subscribe(users => this.userNameMap = new Map(users.map(u => [u.id, u.name])));
  }

  /** Sets up thread routing from URL parameters */
  private setupThreadRouting() {
    combineLatest([this.route.paramMap, this.vm$, authState(this.auth)]).pipe(switchMap(([params, vm, authUser]) => {
      const threadId = params.get('threadId');
      const id = params.get('id');
      if (!threadId || !id) return of(null);
      const isDM = this.router.url.includes('/dm/');
      let msgRef;
      if (isDM && authUser) {
        msgRef = doc(this.fs, `conversations/${this.makeConvId(authUser.uid, id)}/messages/${threadId}`);
      } else {
        msgRef = doc(this.fs, `channels/${id}/messages/${threadId}`);
      }
      return runInInjectionContext(this.env, () => docData(msgRef)).pipe(map((raw: any) => {
        if (!raw) return null;
        return { vm, msg: { id: threadId, text: raw?.text ?? '', authorId: raw?.authorId ?? '', authorName: raw?.authorName ?? 'Unbekannt', authorAvatar: raw?.authorAvatar ?? '/public/images/avatars/avatar-default.svg', createdAt: toDateMaybe(raw?.createdAt) ?? new Date() }, channelId: isDM && authUser ? this.makeConvId(authUser.uid, id) : id, isDM };
      }), startWith(null));
    }), filter((x): x is { vm: Vm; msg: any; channelId: string; isDM: boolean } => !!x)).subscribe(({ vm, msg, channelId, isDM }) => {
      this.thread.openThread({ channelId, header: { title: 'Thread', channel: vm.title }, root: { id: msg.id, author: { id: msg.authorId, name: msg.authorName, avatarUrl: msg.authorAvatar }, text: msg.text, createdAt: msg.createdAt }, isDM });
    });
  }

  /** Creates a conversation ID from two user IDs */
  makeConvId(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_');
  }

  /** Ensures a conversation document exists */
  private async ensureConversation(convId: string, meUid: string, otherUid: string) {
    const snap = await getDoc(doc(this.fs, `conversations/${convId}`));
    if (!snap.exists()) await setDoc(doc(this.fs, `conversations/${convId}`), { participants: [meUid, otherUid], createdAt: serverTimestamp() });
  }

  /** Fixes and normalizes avatar URLs to ensure they are valid paths */
  private fixAvatar(url?: string) {
    if (!url) return '/public/images/avatars/avatar-default.svg';
    return url.startsWith('http') || url.startsWith('/') ? url : `/${url}`;
  }

  /** Checks if the given message was authored by the current user */
  isOwnMessage(m: { authorId?: string } | null | undefined): boolean {
    const uid = this.currentUser?.id ?? this.auth.currentUser?.uid;
    return !!uid && String(m?.authorId ?? '') === String(uid);
  }

  /** Returns the placeholder text for the message composer input */
  composePlaceholder(vm: Vm): string {
    return `Nachricht an ${vm.title || ''}`;
  }

  /** Closes all open popovers and modals */
  closeAllPopovers() { this.ui.closeAllPopovers(); }

  /** Handles mouse leave event on message row, closes edit menu */
  onMessageRowLeave(id: string) {
    if (this.ui.editMenuForId === id) {
      this.ui.editMenuForId = null;
    }
  }

  /** Handles mouse leave but keeps emoji picker open if active */
  onMessageRowLeaveKeepEmoji(id: string) {
    if (this.ui.editMenuForId === id && this.ui.messageEmojiForId !== id) {
      this.ui.editMenuForId = null;
    }
  }

  /** Checks if a message has any reactions */
  hasReactions(m: MessageVm) { return this.emoji.hasReactions(m); }

  /** Returns an array of reaction objects for a message */
  reactionList(m: MessageVm) { return this.emoji.reactionList(m); }

  /** TrackBy function for ngFor on reactions */
  trackReaction = this.emoji.trackReaction;

  /** Currently hovered reaction for tooltip display */
  private hoveredReaction: { msg: MessageVm; emoji: string } | null = null;

  /** Handles mouse hover over a reaction chip */
  onReactionHover(m: MessageVm | null, emoji?: string) {
    if (m && emoji) {
      this.hoveredReaction = { msg: m, emoji };
    } else {
      this.hoveredReaction = null;
    }
  }

  /** Checks if a specific reaction on a message is currently hovered */
  isReactionHovered(m: MessageVm, emoji: string) {
    return this.hoveredReaction?.msg?.id === m.id && this.hoveredReaction?.emoji === emoji;
  }

  /** Returns formatted names of users who reacted with a specific emoji */
  reactionNames(m: MessageVm, emoji: string) { return this.emoji.reactionNames(m, emoji, this.currentUser, this.userNameMap); }

  /** Returns the appropriate verb (singular/plural) for reaction count */
  reactionVerb(m: MessageVm, emoji: string) { return this.emoji.reactionVerb(m, emoji, this.currentUser, this.userNameMap); }

  /** Cancels the current message edit operation */
  cancelEdit() { this.ui.cancelEdit(); }

  /** Closes the channel info modal */
  closeChannelInfoModal() { this.ui.closeChannelInfoModal(); }

  /** Closes the user profile modal */
  closeUserProfileModal() { this.ui.closeUserProfileModal(); }

  /** Navigates to direct message conversation with the user from profile modal */
  sendMessageToUser() {
    const userId = this.ui.userProfileId;
    if (!userId) return;
    this.ui.closeUserProfileModal();
    this.router.navigate(['/dm', userId]);
  }

  /** Closes the members list modal */
  closeMembersModal() { this.ui.closeMembersModal(); }

  /** Closes the add members modal */
  closeAddMembersModal() { this.ui.closeAddMembersModal(); }

  /** Closes emoji picker when clicking outside of it */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    if (!this.ui.messageEmojiForId) return;
    const popEl = this.msgEmojiPopover?.nativeElement;
    if (popEl && popEl.contains(ev.target as Node)) return;
    this.ui.messageEmojiForId = null;
  }

  /** Closes emoji picker on window scroll */
  @HostListener('window:scroll', [])
  onWindowScroll() { if (this.ui.messageEmojiForId) this.ui.messageEmojiForId = null; }

  /** Toggles the edit menu for a message */
  toggleEditMenu(ev: MouseEvent, m: any) {
    ev.stopPropagation();
    if (!this.isOwnMessage(m) || this.ui.editingMessageId === m.id) return;
    if (this.ui.editMenuForId === m.id) { this.ui.editMenuForId = null; return; }
    this.ui.positionEditMenu(ev.currentTarget as HTMLElement);
    this.ui.editMenuForId = m.id;
    this.ui.messageEmojiForId = null;
  }

  /** Starts editing a message */
  startEdit(m: any) { if (!this.isOwnMessage(m)) return; this.ui.startEdit(m.id, (m.text ?? '').toString()); }

  /** Saves the edited message */
  async saveEdit(m: any, vm: Vm) { if (!this.isOwnMessage(m)) return; await this.messageHelper.saveEdit(m, vm, this.ui.editDraft, this.makeConvId.bind(this)); this.ui.cancelEdit(); this.thread.close(); }

  /** Sends a message in the current channel or DM */
  async send(vm: Vm) { await this.messageHelper.sendMessage(vm, this.composer.draft, this.currentUser, this.makeConvId.bind(this), this.ensureConversation.bind(this)); this.composer.draft = ''; }

  /** Sends a message from the compose/new message screen */
  async sendFromCompose() { if (!this.composeTarget) return; await this.messageHelper.sendFromCompose(this.composeTarget, this.composer.draft, this.currentUser, this.makeConvId.bind(this), this.ensureConversation.bind(this), this.router); this.composer.draft = ''; this.composer.to = ''; this.composeTarget = null; }

  /** Handles input in the 'To' field for new messages */
  onToInput(v: string) { this.composer.onToInput(v, []); this.toInput$.next(v); }

  /** Handles emoji selection from the emoji picker */
  onEmojiSelect(e: any) {
    const native = this.emoji.asEmojiString(e);
    if (this.emojiContext === 'message' && this.emojiMessageTarget) {
      this.emoji.addReactionToMessage(this.emojiMessageTarget, native, this.currentUser, this.makeConvId.bind(this));
      this.ui.messageEmojiForId = null;
      this.emojiContext = null;
      return;
    }
    if (this.emojiContext === 'edit') {
      this.ui.editDraft += native;
      this.ui.showEmoji = false;
      return;
    }
    this.composer.draft += native;
  }

  /** Opens a thread view for the selected message */
  async openThread(m: any, vm: any) {
    const routeId = this.route.snapshot.paramMap.get('id');
    if (!routeId) return;
    const isDM = this.router.url.includes('/dm/');
    let channelId = routeId;
    if (isDM) {
      const me = await this.authReady.requireUser();
      channelId = this.makeConvId(me.uid, routeId);
    }
    this.thread.openThread({ channelId, header: { title: 'Thread', channel: vm.kind === 'dm' ? vm.title : vm.title }, root: { id: m.id, author: { id: m.authorId ?? '', name: m.authorName, avatarUrl: m.authorAvatar }, text: m.text, createdAt: m.createdAt ?? new Date() }, isDM });
    if (window.innerWidth <= 1024) {
      if (isDM) {
        this.router.navigate(['/dm', routeId, 'thread', m.id]);
      } else {
        this.router.navigate(['/channel', routeId, 'thread', m.id]);
      }
    }
  }

  /** Handles click on a reaction chip to add/remove reaction */
  onReactionChipClick(ev: MouseEvent, m: MessageVm, emoji: string) {
    ev.stopPropagation();
    this.emoji.addReactionToMessage(m, emoji, this.currentUser, this.makeConvId.bind(this));
  }

  /** Toggles the emoji picker for adding reactions to a message */
  toggleMessageEmojiPicker(ev: MouseEvent, msg: MessageVm, from: 'actions' | 'reactions' = 'reactions') {
    ev.stopPropagation();
    if (this.ui.messageEmojiForId === msg.id) {
      this.ui.messageEmojiForId = null;
      return;
    }
    this.ui.emojiPopoverPos = this.emoji.positionEmojiPopover(ev.currentTarget as HTMLElement);
    this.ui.messageEmojiForId = msg.id;
    this.ui.emojiOpenedFrom = from;
    this.emojiContext = 'message';
    this.emojiMessageTarget = msg;
  }

  /** Opens the emoji picker for the message composer */
  openEmojiForComposer(ev: MouseEvent) {
    ev.stopPropagation();
    if (this.ui.showEmoji && this.emojiContext === 'composer') {
      this.ui.showEmoji = false;
      this.emojiContext = null;
      return;
    }
    this.ui.composerEmojiPos = this.emoji.positionComposerEmoji(ev.currentTarget as HTMLElement);
    this.emojiContext = 'composer';
    this.ui.showEmoji = true;
  }

  /** Opens the emoji picker for editing a message */
  openEmojiForEdit(ev: MouseEvent) {
    ev.stopPropagation();
    if (this.ui.showEmoji && this.emojiContext === 'edit') {
      this.ui.showEmoji = false;
      this.emojiContext = null;
      return;
    }
    this.ui.composerEmojiPos = this.emoji.positionComposerEmoji(ev.currentTarget as HTMLElement);
    this.emojiContext = 'edit';
    this.ui.showEmoji = true;
  }

  /** Toggles the members list popover */
  toggleMembers(evt?: Event) { evt?.stopPropagation(); this.ui.showMembers = !this.ui.showMembers; if (this.ui.showMembers) this.ui.showEmoji = false; }

  /** Inserts a member mention into the message composer */
  insertMention(m: MemberVM) { this.composer.insertMention(m); this.ui.showMembers = false; }

  /** Toggles edit mode for channel name */
  async toggleChannelNameEdit() { const result = await this.modal.toggleChannelNameEdit(this.channelDoc$, this.ui.channelNameEdit, this.ui.editChannelName); this.ui.channelNameEdit = result.edit; this.ui.editChannelName = result.value; }

  /** Toggles edit mode for channel description */
  async toggleChannelDescEdit() { const result = await this.modal.toggleChannelDescEdit(this.channelDoc$, this.ui.channelDescEdit, this.ui.editChannelDesc); this.ui.channelDescEdit = result.edit; this.ui.editChannelDesc = result.value; }

  /** Handles leaving the current channel */
  async onLeaveChannel() { const channelId = this.route.snapshot.paramMap.get('id'); if (!channelId) return; await this.modal.leaveChannel(channelId); this.ui.closeChannelInfoModal(); }

  /** Opens the channel info modal */
  openChannelInfoModal() {
    this.channelDoc$.pipe(filter((ch): ch is ChannelDoc => !!ch), take(1)).subscribe((ch) => {
      this.ui.editChannelName = String(ch.name ?? '').trim();
      this.ui.editChannelDesc = String(ch.topic ?? '').trim();
      this.ui.channelTopic = String(ch.topic ?? '');
    });
    this.ui.openChannelInfoModal();
  }

  /** Opens the user profile modal for a specific user */
  openUserProfileModal(userIdFromList?: string) {
    const id = userIdFromList ?? this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.modal.loadUserProfile(id).pipe(take(1)).subscribe((u: any) => {
      this.ui.userProfile = { name: u?.name ?? 'Unbekannt', email: u?.email, avatarUrl: this.fixAvatar(u?.avatarUrl), status: u?.status || (u?.online ? 'active' : 'inactive') };
      this.ui.openUserProfileModal(id);
    });
  }

  /** Handles click on a member to view their profile */
  onMemberClick(userId: string) { this.ui.closeMembersModal(); this.openUserProfileModal(userId); }

  /** Opens the channel members list modal */
  openMembersModal(event?: MouseEvent) { if (event && this.membersBtn) this.ui.positionModalFrom(this.membersBtn.nativeElement, 'members'); this.ui.openMembersModal(); }

  /** Opens the add members modal */
  openAddMembersModal() { if (this.addMembersBtn) this.ui.positionModalFrom(this.addMembersBtn.nativeElement, 'add'); this.ui.openAddMembersModal(); }

  /** Submits the add member form */
  async submitAddMember() { await this.modal.submitAddMember(this.ui.addMemberName, this.fixAvatar.bind(this)); this.ui.closeAddMembersModal(); }

  /** Handles input in the add member search field */
  onAddMemberInput(value: string) { this.composer.onAddMemberInput(value); this.ui.addMemberInput = value; this.ui.showAddMemberSuggest = value.length > 0; }

  /** Selects a user from the add member suggestions */
  selectAddMember(u: UserMini) { this.ui.addMemberName = u.name; this.ui.addMemberInput = u.name; this.ui.showAddMemberSuggest = false; }

  /** Handles keyboard navigation in the 'To' field suggestions */
  onToKeydown(ev: KeyboardEvent, list: SuggestItem[] | null | undefined) { this.composer.onToKeydown(ev, list); }

  /** Handles blur event on 'To' input field */
  onToBlur() { this.composer.onToBlur(); }

  /** Handles click on a suggestion item */
  onSuggestionClick(ev: MouseEvent, s: SuggestItem) { ev.preventDefault(); this.composer.pickSuggestion(s); this.composeTarget = s; }

  /** Selects a suggestion from the dropdown */
  pickSuggestion(s: SuggestItem) { this.composer.pickSuggestion(s); this.composeTarget = s; }

  /** Handles Enter key in composer to send message */
  onComposerKeydown(event: KeyboardEvent, vm?: Vm) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (vm) this.send(vm); else this.sendFromCompose(); } }

  /** TrackBy function for message list */
  trackMsg = (_: number, m: MessageVm) => m.id;

  /** TrackBy function for member list */
  trackMember = (_: number, m: MemberVM) => m.uid;
}

