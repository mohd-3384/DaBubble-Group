import { AfterViewChecked, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { MentionUser, Message, ReactionVm } from '../../interfaces/allInterfaces.interface';
import { ThreadActionsService } from '../../services/thread-actions.service';
import { ChannelService } from '../../services/channel.service';
import { ThreadUiStateHelper } from './helpers/thread-ui-state.helper';
import { ThreadDisplayHelper } from './helpers/thread-display.helper';
import { ThreadComposerHelper } from './helpers/thread-composer.helper';
import { ThreadMessageHelper } from './helpers/thread-message.helper';
import { ThreadEmojiHelper } from './helpers/thread-emoji.helper';
import { ThreadHoverHelper } from './helpers/thread-hover.helper';
import { ThreadReactionHelper } from './helpers/thread-reaction.helper';
import { ThreadEditHelper } from './helpers/thread-edit.helper';
import { Router } from '@angular/router';

@Component({
  selector: 'app-thread',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerModule],
  providers: [ThreadUiStateHelper, ThreadDisplayHelper, ThreadComposerHelper, ThreadMessageHelper, ThreadEmojiHelper, ThreadHoverHelper, ThreadReactionHelper, ThreadEditHelper],
  templateUrl: './thread.component.html',
  styleUrl: './thread.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThreadComponent implements AfterViewInit, AfterViewChecked, OnChanges {
  /**
   * Creates an instance of ThreadComponent
   * @param host - Reference to the host element
   * @param threadActions - Service for handling thread actions
   * @param ui - Helper for managing UI state
   * @param display - Helper for display functions
   * @param composer - Helper for composer functions
   * @param message - Helper for message operations
   * @param emoji - Helper for emoji pickers
   * @param hover - Helper for hover states
   * @param reaction - Helper for reaction operations
   * @param editHelper - Helper for message editing operations
   * @param cdr - Change detector reference for manual change detection
   */
  constructor(
    private host: ElementRef<HTMLElement>,
    private threadActions: ThreadActionsService,
    private channelService: ChannelService,
    private router: Router,
    public ui: ThreadUiStateHelper,
    public display: ThreadDisplayHelper,
    public composer: ThreadComposerHelper,
    public message: ThreadMessageHelper,
    public emoji: ThreadEmojiHelper,
    public hover: ThreadHoverHelper,
    public reaction: ThreadReactionHelper,
    public editHelper: ThreadEditHelper,
    private cdr: ChangeDetectorRef
  ) { }

  @Input() header: { title: string; channel?: string } = { title: 'Thread' };
  @Input({ required: true }) rootMessage!: Message;
  @Input() replies: Message[] = [];
  @Input() users: MentionUser[] = [];
  @Input() currentUserId: string | null = null;
  @Input({ required: true }) channelId!: string;
  @Input() isDM: boolean = false;

  @Output() send = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<{ messageId: string; text: string }>();

  trackReaction = (_: number, it: ReactionVm) => it.emoji;
  trackReply = (_: number, r: Message) => r.id;
  trackUser = (_: number, u: MentionUser) => u.id;

  @ViewChild('messagesScroll') set messagesScroll(el: ElementRef<HTMLElement> | undefined) {
    this.messagesScrollEl = el?.nativeElement;
    if (this.messagesScrollEl && this.pendingScroll) this.scheduleAutoScroll();
  }
  @ViewChild('threadComposer') set threadComposer(el: ElementRef<HTMLTextAreaElement> | undefined) {
    this.threadComposerEl = el?.nativeElement;
  }
  private messagesScrollEl?: HTMLElement;
  private threadComposerEl?: HTMLTextAreaElement;
  private shouldAutoScroll = true;
  private pendingScroll = false;
  private lastReplyCount = 0;
  private channels: { id: string; name: string }[] = [];
  composerSuggestOpen = false;
  composerSuggestKind: 'user' | 'channel' | null = null;
  composerSuggestItems: Array<{ id: string; name: string; avatarUrl?: string }> = [];
  private composerSuggestStart = -1;
  private composerSuggestPrefix: '@' | '#' | null = null;
  private userNameToId = new Map<string, string>();
  private channelNameToId = new Map<string, string>();
  private userMentions: Array<{ id: string; name: string; nameLower: string }> = [];
  private channelMentions: Array<{ id: string; name: string; nameLower: string }> = [];

  /**
   * Handles document click events to close open popovers
   * @param ev - The mouse event
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    if (this.composerSuggestOpen) {
      this.closeComposerSuggest();
    }
    const target = ev.target as Node | null;
    if (!target) return;
    if (this.host.nativeElement.contains(target)) return;
    this.ui.closePopovers();
  }

  ngAfterViewInit(): void {
    this.pendingScroll = true;
    this.focusComposer();
    this.channelService.channels$().subscribe((list) => {
      this.channels = (list || []).map((c) => ({ id: c.id || '', name: c.name || '' }));
      this.channelNameToId = new Map(
        this.channels
          .filter((c) => !!c?.id && !!c?.name)
          .map((c) => [this.normalizeName(c.name), c.id])
      );
      this.channelMentions = this.channels
        .filter((c) => !!c?.id && !!c?.name)
        .map((c) => ({ id: c.id, name: c.name, nameLower: String(c.name).toLowerCase() }))
        .sort((a, b) => b.name.length - a.name.length);
    });
  }

  ngAfterViewChecked(): void {
    if (!this.pendingScroll) return;
    this.pendingScroll = false;
    this.tryAutoScroll();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rootMessage']) {
      this.pendingScroll = true;
      this.focusComposer();
    }

    if (changes['users']) {
      const validUsers = (this.users || []).filter(this.isMentionUserWithIdName);
      this.userNameToId = new Map(
        validUsers.map((u) => [this.normalizeName(u.name), u.id])
      );
      this.userMentions = validUsers
        .map((u) => ({ id: u.id, name: u.name, nameLower: String(u.name).toLowerCase() }))
        .sort((a, b) => b.name.length - a.name.length);
    }

    if (changes['replies']) {
      const nextCount = this.replies?.length ?? 0;
      if (nextCount !== this.lastReplyCount) {
        this.lastReplyCount = nextCount;
        this.pendingScroll = true;
      }
    }
  }

  private focusComposer(): void {
    setTimeout(() => {
      this.threadComposerEl?.focus();
    });
  }

  onMessagesScroll(): void {
    const el = this.messagesScrollEl;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.shouldAutoScroll = distance < 80;
  }

  private tryAutoScroll(): void {
    if (!this.shouldAutoScroll) return;
    this.scheduleAutoScroll();
  }

  private scheduleAutoScroll(): void {
    if (!this.shouldAutoScroll) return;
    const el = this.messagesScrollEl;
    if (!el || typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }

  /**
   * Toggles the emoji picker visibility in the composer
   * @param evt - Optional event to stop propagation
   */
  toggleEmoji(evt?: Event) {
    evt?.stopPropagation();
    this.ui.showEmoji = !this.ui.showEmoji;
    if (this.ui.showEmoji) this.ui.showUsers = false;
  }

  /**
   * Toggles the user mention picker visibility in the composer
   * @param evt - Optional event to stop propagation
   */
  toggleUsers(evt?: Event) {
    evt?.stopPropagation();
    this.ui.showUsers = !this.ui.showUsers;
    if (this.ui.showUsers) this.ui.showEmoji = false;
  }

  /**
   * Inserts a user mention into the composer draft
   * @param u - The user to mention
   */
  insertMention(u: MentionUser) {
    this.composer.insertMention(u);
    this.ui.showUsers = false;
  }

  onComposerInput(value: string): void {
    this.updateComposerSuggest(value);
  }

  selectComposerSuggest(item: { id: string; name: string; avatarUrl?: string }): void {
    if (!this.composerSuggestPrefix || this.composerSuggestStart < 0) return;
    const prefix = this.composerSuggestPrefix;
    const before = this.composer.draft.slice(0, this.composerSuggestStart);
    const after = this.composer.draft.slice(this.composerSuggestStart);
    const replacement = `${prefix}${item.name} `;
    const next = before + replacement + after.replace(/^[^\s]*\s*/, '');
    this.composer.draft = next;
    this.closeComposerSuggest();
  }

  getMessageParts(text: string | null | undefined): Array<{ kind: 'text' | 'user' | 'channel'; value: string; id?: string }> {
    const raw = String(text ?? '');
    const parts: Array<{ kind: 'text' | 'user' | 'channel'; value: string; id?: string }> = [];
    const lower = raw.toLowerCase();
    let index = 0;

    while (index < raw.length) {
      const nextIndex = this.findNextMentionIndex(raw, index);
      if (nextIndex < 0) {
        if (index < raw.length) parts.push({ kind: 'text', value: raw.slice(index) });
        break;
      }

      if (nextIndex > index) {
        parts.push({ kind: 'text', value: raw.slice(index, nextIndex) });
      }

      const prefix = raw[nextIndex];
      const kind = prefix === '@' ? 'user' : 'channel';
      const match = this.matchMentionAt(lower, nextIndex + 1, kind);

      if (match) {
        const token = raw.slice(nextIndex, nextIndex + 1 + match.name.length);
        parts.push({ kind, value: token, id: match.id });
        index = nextIndex + 1 + match.name.length;
        continue;
      }

      parts.push({ kind: 'text', value: raw.slice(nextIndex, nextIndex + 1) });
      index = nextIndex + 1;
    }

    return parts;
  }

  onMentionClick(part: { kind: 'text' | 'user' | 'channel'; id?: string }): void {
    if (!part.id || part.kind === 'text') return;
    if (part.kind === 'user') {
      this.router.navigate(['/dm', part.id]);
      return;
    }
    this.router.navigate(['/channel', part.id]);
  }

  private normalizeName(value: string): string {
    return String(value || '').trim().replace(/^[@#]/, '').toLowerCase();
  }

  private isMentionUserWithIdName(user: MentionUser | null | undefined): user is MentionUser & { id: string; name: string } {
    return !!user?.id && !!user?.name;
  }

  private findNextMentionIndex(text: string, fromIndex: number): number {
    const atIndex = text.indexOf('@', fromIndex);
    const hashIndex = text.indexOf('#', fromIndex);
    if (atIndex === -1) return hashIndex;
    if (hashIndex === -1) return atIndex;
    return Math.min(atIndex, hashIndex);
  }

  private matchMentionAt(
    lowerText: string,
    startIndex: number,
    kind: 'user' | 'channel'
  ): { id: string; name: string } | null {
    const list = kind === 'user' ? this.userMentions : this.channelMentions;
    for (const item of list) {
      if (!item.nameLower) continue;
      if (lowerText.startsWith(item.nameLower, startIndex)) {
        const endIndex = startIndex + item.name.length;
        const nextChar = lowerText[endIndex];
        if (!nextChar || /[\s.,!?;:)\]]/.test(nextChar)) {
          return { id: item.id, name: item.name };
        }
      }
    }
    return null;
  }

  private updateComposerSuggest(draft: string): void {
    const match = /(^|\s)([@#])([^\s]*)$/.exec(draft);
    if (!match) {
      this.closeComposerSuggest();
      return;
    }

    const prefix = match[2] as '@' | '#';
    const query = (match[3] || '').toLowerCase();
    const startIndex = draft.length - (match[2].length + match[3].length);

    if (prefix === '@') {
      const list = (this.users || [])
        .filter((u) => u.name.toLowerCase().includes(query))
        .slice(0, 8)
        .map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }));
      this.setComposerSuggest('user', list, startIndex, prefix);
      return;
    }

    const list = this.channels
      .filter((c) => c.name.toLowerCase().includes(query))
      .slice(0, 8)
      .map((c) => ({ id: c.id, name: c.name }));
    this.setComposerSuggest('channel', list, startIndex, prefix);
  }

  private setComposerSuggest(
    kind: 'user' | 'channel',
    items: Array<{ id: string; name: string; avatarUrl?: string }>,
    startIndex: number,
    prefix: '@' | '#'
  ): void {
    this.composerSuggestKind = kind;
    this.composerSuggestItems = items;
    this.composerSuggestStart = startIndex;
    this.composerSuggestPrefix = prefix;
    this.composerSuggestOpen = true;
  }

  private closeComposerSuggest(): void {
    this.composerSuggestOpen = false;
    this.composerSuggestKind = null;
    this.composerSuggestItems = [];
    this.composerSuggestStart = -1;
    this.composerSuggestPrefix = null;
  }

  closeComposerSuggestFromUi(): void {
    this.closeComposerSuggest();
  }

  /**
   * Handles send button click to submit a new reply
   * @param evt - Optional event to stop propagation
   */
  onSendClick(evt?: Event) {
    evt?.stopPropagation();
    const text = this.composer.getTrimmedDraft();
    if (!text) return;

    this.shouldAutoScroll = true;
    this.pendingScroll = true;

    this.send.emit(text);
    this.composer.clearDraft();
    this.ui.closePopovers();
  }

  /**
   * Checks if a message belongs to the current user
   * @param m - The message to check
   * @returns True if the message author matches current user ID
   */
  isOwnMessage(m: { author?: { id?: string } } | null | undefined): boolean {
    return this.message.isOwnMessage(m, this.currentUserId);
  }

  /**
   * Toggles the edit menu for a message
   * @param ev - The mouse event
   * @param m - The message to edit
   */
  toggleEditMenu(ev: MouseEvent, m: Message) {
    this.message.toggleEditMenu(ev, m, this.currentUserId);
  }

  /**
   * Starts editing a message
   * @param m - The message to edit
   */
  startEdit(m: Message) {
    this.message.startEdit(m, this.currentUserId);
  }

  /**
   * Deletes a message
   * @param m - The message to delete
   */
  async deleteMessage(m: Message) {
    if (!this.isOwnMessage(m)) return;
    const isRoot = m.id === this.rootMessage.id;
    await this.threadActions.deleteMessage(m.id, this.rootMessage.id, this.channelId, this.isDM, isRoot);
    this.ui.closePopovers();
    this.ui.cancelEdit(m.id);
    if (isRoot) this.close.emit();
  }

  /**
   * Cancels editing a message and resets edit state
   * @param m - Optional message to cancel editing for
   */
  cancelEdit(m?: Message) {
    this.ui.cancelEdit(m?.id);
  }

  /**
   * Saves the edited message to Firestore
   * @param m - The message being edited
   */
  async saveEdit(m: Message) {
    if (!this.isOwnMessage(m)) return;
    const next = (this.ui.editDraft || '').trim();
    if (!this.editHelper.shouldSaveEdit(m, next)) {
      this.cancelEdit(m);
      return;
    }
    await this.editHelper.performSaveEdit(m, next, this.rootMessage, this.channelId, this.isDM);
    this.editHelper.resetEditState();
  }

  /**
   * Handles mouse enter on a message row
   * @param id - The message ID
   */
  onRowEnter(id: string) {
    this.hover.onRowEnter(id);
  }

  /**
   * Handles mouse leave on a message row
   * @param id - The message ID
   */
  onRowLeave(id: string) {
    this.hover.onRowLeave(id);
  }

  /**
   * Handles mouse enter on a popover element
   * @param id - The message ID
   */
  onPopoverEnter(id: string) {
    this.hover.onPopoverEnter(id);
  }

  /**
   * Handles mouse leave on a popover element
   * @param id - The message ID
   */
  onPopoverLeave(id: string) {
    this.hover.onPopoverLeave(id);
  }

  /**
   * Toggles the emoji picker for adding reactions to a message
   * @param ev - The mouse event
   * @param messageId - The message ID to react to
   */
  toggleMessageEmojiPicker(ev: MouseEvent, messageId: string) {
    this.emoji.toggleMessageEmojiPicker(ev, messageId);
  }

  /**
   * Toggles the emoji picker for editing message text
   * @param ev - The mouse event
   * @param messageId - The message ID being edited
   */
  toggleEditEmojiPicker(ev: MouseEvent, messageId: string) {
    this.emoji.toggleEditEmojiPicker(ev, messageId);
  }

  /**
   * Handles emoji selection for editing message text
   * @param e - The emoji selection event
   */
  onEditEmojiSelect(e: any) {
    this.emoji.onEditEmojiSelect(e);
  }

  /**
   * Handles emoji selection for the composer input
   * @param e - The emoji selection event
   */
  onComposerEmojiSelect(e: any) {
    const emoji = this.reaction.emojiToString(e);
    if (!emoji) return;

    this.composer.addEmoji(emoji);
    this.ui.showEmoji = false;
  }

  /**
   * Handles emoji selection for message reactions
   * @param e - The emoji selection event
   */
  onEmojiSelect(e: any) {
    const emoji = this.reaction.emojiToString(e);
    if (!emoji || !this.ui.messageEmojiForId) return;
    const msg = this.message.findMessageById(this.ui.messageEmojiForId, this.rootMessage, this.replies);
    const ctx = msg.id === this.rootMessage.id ? 'root' : 'reply';
    this.toggleReaction(msg, emoji, ctx);
    this.ui.messageEmojiForId = null;
  }

  /**
   * Gets reactions for a message in view model format
   * @param m - The message
   * @returns Array of reaction view models
   */
  reactionsFor(m: Message): ReactionVm[] {
    return this.threadActions.getReactionsForMessage(m, this.currentUserId);
  }

  /**
   * Gets the visible reactions list for thread messages
   * @param m - The message
   * @returns Limited reaction list
   */
  visibleReactionsFor(m: Message): ReactionVm[] {
    const list = this.reactionsFor(m);
    return list.slice(0, 7);
  }

  /**
   * Gets the number of hidden reactions for thread messages
   * @param m - The message
   * @returns Count of hidden reactions
   */
  reactionOverflowCount(m: Message): number {
    const list = this.reactionsFor(m);
    return Math.max(0, list.length - 7);
  }

  /**
   * Checks if the current user reacted to a message with a specific emoji
   * @param m - The message
   * @param emoji - The emoji to check
   * @returns True if the user reacted
   */
  didUserReact(m: Message, emoji: string): boolean {
    return this.threadActions.didUserReact(m, emoji, this.currentUserId);
  }

  /**
   * Gets the names of users who reacted with a specific emoji
   * @param m - The message
   * @param emoji - The emoji to check
   * @returns Array of user names
   */
  getReactedUserNames(m: Message, emoji: string): string[] {
    return this.display.getReactedUserNames(m, emoji, this.users);
  }

  /**
   * Toggles a reaction on a message
   * @param m - The message
   * @param emojiInput - The emoji to toggle
   * @param ctx - Context ('root' or 'reply')
   */
  async toggleReaction(m: Message, emojiInput: any, ctx: 'root' | 'reply') {
    await this.reaction.toggleReaction(
      m,
      emojiInput,
      ctx,
      this.rootMessage,
      this.channelId,
      this.currentUserId,
      this.isDM
    );
  }

  /**
   * Handles hovering over a reaction chip
   * @param m - The message (null to clear hover)
   * @param emoji - Optional emoji being hovered
   */
  onReactionHover(m: Message | null, emoji?: string) {
    this.hover.onReactionHover(m, emoji);
  }

  /**
   * Checks if a specific reaction is currently hovered
   * @param m - The message
   * @param emoji - The emoji
   * @returns True if this reaction is hovered
   */
  isReactionHovered(m: Message, emoji: string): boolean {
    return this.hover.isReactionHovered(m, emoji);
  }

  /**
   * Gets formatted user names for a reaction tooltip
   * @param m - The message
   * @param emoji - The emoji
   * @returns Array of user names (including 'Du' for current user)
   */
  reactionNames(m: Message, emoji: string): string[] {
    return this.display.getReactionNames(m, emoji, this.users, this.currentUserId);
  }

  /**
   * Gets the appropriate German verb for reaction tooltip
   * @param m - The message
   * @param emoji - The emoji
   * @returns Verb string ('hast reagiert', 'hat reagiert', or 'haben reagiert')
   */
  reactionVerb(m: Message, emoji: string): string {
    return this.display.getReactionVerb(m, emoji, this.users, this.currentUserId);
  }

  /**
   * Gets the display name for a user ID
   * @param uid - Optional user ID
   * @returns User name or 'Unbekannt' if not found
   */
  userName(uid?: string | null): string {
    return this.display.getUserName(uid, this.users);
  }

  /**
   * Gets the avatar URL for a user ID
   * @param uid - Optional user ID
   * @returns Avatar URL or default avatar if not found
   */
  userAvatar(uid?: string | null): string {
    return this.display.getUserAvatar(uid, this.users);
  }

  /**
   * Handles keydown events in the composer textarea
   * @param event - The keyboard event
   */
  onComposerKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendClick();
    }
  }
}
