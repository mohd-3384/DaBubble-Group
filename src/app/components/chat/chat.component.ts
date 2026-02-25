import { AfterViewChecked, AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { ChannelDoc, DayGroup, MemberVM, MessageVm, SuggestItem, UserDoc, Vm, UserMini, } from '../../interfaces/allInterfaces.interface';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { ChannelService } from '../../services/channel.service';
import { ChannelJoinNoticeService } from '../../services/channel-join-notice.service';
import { MessageSendHelper } from './helpers/message-send.helper';
import { MessageEditHelper } from './helpers/message-edit.helper';
import { ReactionHelper } from './helpers/reaction.helper';
import { EmojiHelper } from './helpers/emoji.helper';
import { EmojiPopoverHelper } from './helpers/emoji-popover.helper';
import { ModalPositionHelper } from './helpers/modal-position.helper';
import { ChannelModalHelper } from './helpers/channel-modal.helper';
import { MembersModalHelper } from './helpers/members-modal.helper';
import { UserProfileHelper } from './helpers/user-profile.helper';
import { EditMenuHelper } from './helpers/edit-menu.helper';
import { UiStateHelper } from './helpers/ui-state.helper';
import { ComposeHelper } from './helpers/compose.helper';
import { MentionHelper } from './helpers/mention.helper';
import { ThreadHelper } from './helpers/thread.helper';
import { isOwnMessage } from './helpers/message.utils';
import { ChatStateHelper } from './helpers/chat-state.helper';
import { ViewUtilsHelper } from './helpers/view-utils.helper';
import { MessageCheckHelper } from './helpers/message-check.helper';
import { ModalCoordinatorHelper } from './helpers/modal-coordinator.helper';
import { EmojiCoordinatorHelper } from './helpers/emoji-coordinator.helper';
import { ReactionCoordinatorHelper } from './helpers/reaction-coordinator.helper';
import { ChatStreamsHelper } from './helpers/chat-streams.helper';
import { ChatRefsHelper } from './helpers/chat-refs.helper';
import { createStateProxies } from './helpers/state-proxy.helper';
import { MessageDataHelper } from './helpers/message-data.helper';
import { UserDataHelper } from './helpers/user-data.helper';
import { MemberDataHelper } from './helpers/member-data.helper';
import { ChannelDataHelper } from './helpers/channel-data.helper';
import { MessageGroupHelper } from './helpers/message-group.helper';
import { SuggestHelper } from './helpers/suggest.helper';
import { ViewModelHelper } from './helpers/view-model.helper';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  providers: [ChatStateHelper, ChatStreamsHelper, ChatRefsHelper, MessageDataHelper, UserDataHelper, MemberDataHelper, ChannelDataHelper, MessageGroupHelper, SuggestHelper, ViewModelHelper, MessageSendHelper, MessageEditHelper, ReactionHelper, EmojiHelper, EmojiPopoverHelper, ModalPositionHelper, ChannelModalHelper, MembersModalHelper, UserProfileHelper, EditMenuHelper, UiStateHelper, ComposeHelper, MentionHelper, ThreadHelper, ViewUtilsHelper, MessageCheckHelper, ModalCoordinatorHelper, EmojiCoordinatorHelper, ReactionCoordinatorHelper,
  ],
})
export class ChatComponent implements AfterViewInit, AfterViewChecked, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private chanSvc = inject(ChannelService);
  private state = inject(ChatStateHelper);
  private streams = inject(ChatStreamsHelper);
  private refs = inject(ChatRefsHelper);
  private messageSend = inject(MessageSendHelper);
  private messageEdit = inject(MessageEditHelper);
  private joinNotice = inject(ChannelJoinNoticeService);
  private reactionCoordinator = inject(ReactionCoordinatorHelper);
  private modalCoordinator = inject(ModalCoordinatorHelper);
  private emojiCoordinator = inject(EmojiCoordinatorHelper);
  private editMenu = inject(EditMenuHelper);
  private uiState = inject(UiStateHelper);
  private compose = inject(ComposeHelper);
  private mention = inject(MentionHelper);
  private thread = inject(ThreadHelper);
  private viewUtils = inject(ViewUtilsHelper);
  private messageCheck = inject(MessageCheckHelper);

  @ViewChild('toInputEl') set toInputEl(el: ElementRef<HTMLInputElement>) { this.refs.setToInputEl(el); }
  @ViewChild('composerInput') set composerInputEl(el: ElementRef<HTMLTextAreaElement>) { this.refs.setComposerInputEl(el); }
  @ViewChild('membersBtn') set membersBtn(el: ElementRef<HTMLElement>) { this.refs.setMembersBtn(el); }
  @ViewChild('addMembersBtn') set addMembersBtn(el: ElementRef<HTMLElement>) { this.refs.setAddMembersBtn(el); }
  @ViewChild('msgEmojiPopover') set msgEmojiPopover(el: ElementRef<HTMLElement>) { this.refs.setMsgEmojiPopover(el); }
  @ViewChild('messagesScroll') set messagesScroll(el: ElementRef<HTMLElement> | undefined) {
    this.messagesScrollEl = el?.nativeElement;
    if (this.messagesScrollEl && this.pendingScroll) this.scheduleAutoScroll();
  }

  private streamsData!: ReturnType<typeof this.streams.initializeStreams>;
  vm$!: Observable<Vm>;
  messages$!: Observable<MessageVm[]>;
  groups$!: Observable<DayGroup[]>;
  isEmpty$!: Observable<boolean>;
  members$!: Observable<MemberVM[]>;
  channelDoc$!: Observable<ChannelDoc | null>;
  channelCreator$!: Observable<UserDoc | null>;
  usersAll$!: Observable<UserMini[]>;
  channelsAll$!: Observable<{ id: string; name: string }[]>;
  suggestions$!: Observable<SuggestItem[]>;
  addMemberSuggestions$!: Observable<UserMini[]>;
  composeMode$!: Observable<boolean>;

  trackMsg = (i: number, m: MessageVm) => this.viewUtils.trackMsg(i, m);
  trackMember = (i: number, m: MemberVM) => this.viewUtils.trackMember(i, m);
  trackReaction = (i: number, r: { emoji: string; count: number }) => this.viewUtils.trackReaction(i, r);
  emojiMartCfg = this.viewUtils.getEmojiMartConfig();

  composeMode!: boolean; currentUser!: any; showEmoji!: boolean; emojiContext!: any;
  emojiMessageTarget!: any; composerEmojiPos!: any; messageEmojiForId!: any;
  emojiPopoverPos!: any; emojiOpenedFrom!: any; editMenuForId!: any; editMenuPos!: any;
  editingMessageId!: any; editDraft!: string; to!: string; suggestOpen!: boolean;
  suggestIndex!: number; draft!: string; composeTarget!: any; showMembers!: boolean;
  channelInfoOpen!: boolean; channelNameEdit!: boolean; channelDescEdit!: boolean;
  editChannelName!: string; editChannelDesc!: string; channelTopic!: string;
  channelNameError!: string;
  membersModalOpen!: boolean; membersModalPos!: any; addMembersOpen!: boolean;
  addMembersModalPos!: any; addMemberInput!: string; showAddMemberSuggest!: boolean;
  addMemberSelected!: any; userProfileOpen!: boolean; userProfileId!: string | null; userProfile!: any;
  hoveredReaction!: any; showJoinChannelPopup!: boolean;
  private lastConversationId: string | null = null;
  private shouldAutoScroll = true;
  private pendingScroll = false;
  private messagesSub?: Subscription;
  private joinNoticeSub?: Subscription;
  private joinPopupTimer?: ReturnType<typeof setTimeout>;
  private messagesScrollEl?: HTMLElement;

  constructor() {
    createStateProxies(this.state, this);
    this.streamsData = this.streams.initializeStreams();
    this.vm$ = this.streamsData.vm$;
    this.messages$ = this.streamsData.messages$;
    this.groups$ = this.streamsData.groups$;
    this.isEmpty$ = this.streamsData.isEmpty$;
    this.members$ = this.streamsData.members$;
    this.channelDoc$ = this.streamsData.channelDoc$;
    this.channelCreator$ = this.streamsData.channelCreator$;
    this.usersAll$ = this.streamsData.usersAll$;
    this.channelsAll$ = this.streamsData.channelsAll$;
    this.suggestions$ = this.streamsData.suggestions$;
    this.addMemberSuggestions$ = this.streamsData.addMemberSuggestions$;
    this.composeMode$ = this.streamsData.composeMode$;
    this.streams.initializeCurrentUser();
    this.streams.initializeThreadFromRoute(this.vm$);
    this.bindComposerFocusOnChannelSwitch();
    this.bindAutoScroll();
    this.bindJoinNotice();
  }

  ngAfterViewInit(): void {
    this.pendingScroll = true;
  }

  ngAfterViewChecked(): void {
    if (!this.pendingScroll) return;
    this.pendingScroll = false;
    this.tryAutoScroll();
  }

  ngOnDestroy(): void {
    this.messagesSub?.unsubscribe();
    this.joinNoticeSub?.unsubscribe();
    if (this.joinPopupTimer) {
      clearTimeout(this.joinPopupTimer);
    }
  }

  private bindJoinNotice(): void {
    this.joinNoticeSub = this.joinNotice.notice$.subscribe(() => {
      this.triggerJoinChannelNotice();
    });
  }

  private triggerJoinChannelNotice(): void {
    this.state.showJoinChannelPopup = true;
    if (this.joinPopupTimer) {
      clearTimeout(this.joinPopupTimer);
    }
    this.joinPopupTimer = setTimeout(() => {
      this.state.showJoinChannelPopup = false;
    }, 2400);
  }

  private bindAutoScroll(): void {
    this.messagesSub = this.messages$.subscribe(() => {
      this.pendingScroll = true;
      this.scheduleAutoScroll();
    });
  }

  onMessagesScroll(): void {
    this.closeAllPopovers();
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
   * Focuses the composer input when switching channels
   */
  private bindComposerFocusOnChannelSwitch(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) return;

      if (this.lastConversationId && this.lastConversationId !== id) {
        this.focusComposerInput();
      }

      this.lastConversationId = id;
    });
  }

  /**
   * Focuses the main composer input when available
   */
  private focusComposerInput(): void {
    if (this.state.composeMode) return;
    setTimeout(() => {
      this.refs.composerInputEl?.nativeElement.focus();
    });
  }

  /**
   * Sends a message in the current channel or DM
   * @param vm - View model containing conversation details
   */
  async send(vm: Vm): Promise<void> {
    if (vm.kind === 'channel') {
      const channelId = this.route.snapshot.paramMap.get('id');
      if (channelId) {
        const isMember = await this.chanSvc.isCurrentUserMember(channelId);
        if (!isMember) {
          this.triggerJoinChannelNotice();
          return;
        }
      }
    }
    this.shouldAutoScroll = true;
    this.pendingScroll = true;
    await this.messageSend.send(vm, this.state.draft, this.state.currentUser);
    this.state.draft = '';
    this.state.showEmoji = false;
  }

  /**
   * Sends a message from the compose mode (new message)
   */
  async sendFromCompose(): Promise<void> {
    this.shouldAutoScroll = true;
    this.pendingScroll = true;
    await this.messageSend.sendFromCompose(this.state.composeTarget, this.state.draft, this.state.currentUser);
    this.state.draft = '';
    this.state.to = '';
    this.state.composeTarget = null;
    this.state.showEmoji = false;
  }

  /**
   * Starts editing a message
   * @param m - Message to edit
   */
  startEdit(m: any): void {
    const text = this.messageEdit.startEdit(m, this.state.currentUser?.id ?? null);
    if (!text) return;
    this.closeAllPopovers();
    this.state.editingMessageId = m.id;
    this.state.editDraft = text;
  }

  /**
   * Cancels the current message edit operation
   */
  cancelEdit(): void {
    this.state.editingMessageId = null;
    this.state.editDraft = '';
    this.state.showEmoji = false;
    this.state.emojiContext = null;
  }

  /**
   * Saves the edited message to Firestore
   * @param m - Message being edited
   * @param vm - View model containing conversation details
   */
  async saveEdit(m: any, vm: Vm): Promise<void> {
    await this.messageEdit.saveEdit(m, this.state.editDraft, vm, this.state.currentUser?.id ?? null);
    this.cancelEdit();
  }

  /**
   * Deletes a message
   * @param m - Message to delete
   * @param vm - View model containing conversation details
   */
  async deleteMessage(m: any, vm: Vm): Promise<void> {
    const ok = await this.messageEdit.deleteMessage(m, vm, this.state.currentUser?.id ?? null);
    if (!ok) return;
    if (this.state.editingMessageId === m.id) this.cancelEdit();
    this.closeAllPopovers();
  }

  /**
   * Checks if a message was sent by the current user
   * @param m - Message to check
   * @returns True if message is from current user
   */
  isOwnMessage(m: { authorId?: string } | null | undefined): boolean {
    const uid = this.state.currentUser?.id;
    return !!uid && !!m?.authorId && m.authorId === uid;
  }

  /**
   * Adds an emoji reaction to a message
   * @param m - Message to react to
   * @param emoji - Emoji to add
   */
  async addReactionToMessage(m: MessageVm, emoji: string): Promise<void> {
    await this.reactionCoordinator.addReactionToMessage(m, emoji);
  }

  /**
   * Handles click on a reaction chip
   * @param ev - Mouse event
   * @param m - Message
   * @param emoji - Emoji that was clicked
   */
  onReactionChipClick(ev: MouseEvent, m: MessageVm, emoji: string): void {
    this.reactionCoordinator.onReactionChipClick(ev, m, emoji);
  }

  /**
   * Checks if a message has any reactions
   * @param m - Message to check
   * @returns True if message has reactions
   */
  hasReactions(m: MessageVm): boolean {
    return this.reactionCoordinator.hasReactions(m);
  }

  /**
   * Gets list of reactions for a message
   * @param m - Message
   * @returns Array of reaction objects with emoji and count
   */
  reactionList(m: MessageVm): Array<{ emoji: string; count: number }> {
    return this.reactionCoordinator.reactionList(m);
  }

  /**
   * Gets the visible reactions list based on viewport
   * @param m - Message
   * @returns Limited reaction list
   */
  visibleReactions(m: MessageVm): Array<{ emoji: string; count: number }> {
    const list = this.reactionCoordinator.reactionList(m);
    const max = this.getMaxReactions();
    return list.slice(0, max);
  }

  /**
   * Gets the number of hidden reactions based on viewport
   * @param m - Message
   * @returns Count of hidden reactions
   */
  reactionOverflowCount(m: MessageVm): number {
    const list = this.reactionCoordinator.reactionList(m);
    const max = this.getMaxReactions();
    return Math.max(0, list.length - max);
  }

  /**
   * Checks if a specific user has reacted with an emoji
   * @param m - Message
   * @param emoji - Emoji to check
   * @param uid - User ID
   * @returns True if user has reacted with this emoji
   */
  hasUserReacted(m: MessageVm, emoji: string, uid: string): boolean {
    return this.reactionCoordinator.hasUserReacted(m, emoji, uid);
  }

  /**
   * Gets names of users who reacted with a specific emoji
   * @param m - Message
   * @param emoji - Emoji
   * @returns Array of user names
   */
  reactionNames(m: MessageVm, emoji: string): string[] {
    return this.reactionCoordinator.reactionNames(m, emoji);
  }

  /**
   * Gets appropriate verb for reaction tooltip ("hat/haben reagiert")
   * @param m - Message
   * @param emoji - Emoji
   * @returns Verb string for tooltip
   */
  reactionVerb(m: MessageVm, emoji: string): string {
    return this.reactionCoordinator.reactionVerb(m, emoji);
  }

  /**
   * Gets the max number of reactions to show based on viewport
   * @returns Max visible reactions
   */
  private getMaxReactions(): number {
    return this.isMobileViewport() ? 7 : 20;
  }

  /**
   * Checks if current viewport is considered mobile
   * @returns True if mobile viewport
   */
  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false;
    const width = window.innerWidth || document.documentElement.clientWidth;
    return width <= 768;
  }

  /**
   * Handles hover over a reaction
   * @param m - Message
   * @param emoji - Emoji being hovered
   */
  onReactionHover(m: MessageVm | null, emoji?: string): void {
    this.reactionCoordinator.onReactionHover(m, emoji);
  }

  /**
   * Checks if a reaction is currently hovered
   * @param m - Message
   * @param emoji - Emoji
   * @returns True if this reaction is hovered
   */
  isReactionHovered(m: MessageVm, emoji: string): boolean {
    return this.reactionCoordinator.isReactionHovered(m, emoji);
  }

  /**
   * Toggles the emoji picker visibility
   * @param evt - Optional event to stop propagation
   */
  toggleEmoji(evt?: Event): void {
    this.emojiCoordinator.toggleEmoji(evt);
  }

  /**
   * Closes the emoji picker
   */
  closeEmoji(): void {
    this.emojiCoordinator.closeEmoji();
  }

  /**
   * Handles emoji selection from picker
   * @param e - Emoji selection event
   */
  async onEmojiSelect(e: any): Promise<void> {
    await this.emojiCoordinator.onEmojiSelect(e);
  }

  /**
   * Opens emoji picker for message composer
   * @param ev - Mouse event for positioning
   */
  openEmojiForComposer(ev: MouseEvent): void {
    this.emojiCoordinator.openEmojiForComposer(ev);
  }

  /**
   * Opens emoji picker for edit mode
   * @param ev - Mouse event for positioning
   */
  openEmojiForEdit(ev: MouseEvent): void {
    this.emojiCoordinator.openEmojiForEdit(ev);
  }

  /**
   * Toggles emoji picker for a specific message
   * @param ev - Mouse event for positioning
   * @param msg - Message to add emoji to
   * @param from - Source of the emoji picker (actions or reactions)
   */
  toggleMessageEmojiPicker(ev: MouseEvent, msg: MessageVm, from: 'actions' | 'reactions' = 'reactions'): void {
    this.emojiCoordinator.toggleMessageEmojiPicker(ev, msg, from);
  }

  /**
   * Closes the message-specific emoji popover
   */
  private closeMessageEmojiPopover(): void {
    this.emojiCoordinator.closeMessageEmojiPopover();
  }

  /**
   * Handles direct emoji click (custom element)
   * @param event - Emoji click event
   */
  onEmojiClick(event: any): void {
    this.emojiCoordinator.onEmojiClick(event);
  }

  /**
   * Opens the channel info modal
   */
  async openChannelInfoModal(): Promise<void> {
    await this.modalCoordinator.openChannelInfoModal(this.channelDoc$);
  }

  /**
   * Closes the channel info modal
   */
  closeChannelInfoModal(): void {
    this.modalCoordinator.closeChannelInfoModal();
  }

  /**
   * Toggles channel name edit mode (edit/save)
   */
  async toggleChannelNameEdit(): Promise<void> {
    await this.modalCoordinator.toggleChannelNameEdit(this.channelDoc$);
  }

  /**
   * Clears channel name error on input
   * @param value - New channel name
   */
  onChannelNameInput(value: string): void {
    this.state.editChannelName = value;
    this.state.channelNameError = '';
  }

  /**
   * Toggles channel description edit mode (edit/save)
   */
  async toggleChannelDescEdit(): Promise<void> {
    await this.modalCoordinator.toggleChannelDescEdit(this.channelDoc$);
  }

  /**
   * Handles leaving the current channel
   */
  async onLeaveChannel(): Promise<void> {
    await this.modalCoordinator.onLeaveChannel();
  }

  /**
   * Opens the members modal
   * @param event - Optional mouse event
   */
  openMembersModal(event?: MouseEvent): void {
    this.modalCoordinator.openMembersModal(event);
  }

  /**
   * Closes the members modal
   */
  closeMembersModal(): void {
    this.modalCoordinator.closeMembersModal();
  }

  /**
   * Opens the add members modal
   */
  openAddMembersModal(): void {
    this.modalCoordinator.openAddMembersModal();
  }

  /**
   * Closes the add members modal
   */
  closeAddMembersModal(): void {
    this.modalCoordinator.closeAddMembersModal();
  }

  /**
   * Submits the add member operation
   */
  async submitAddMember(): Promise<void> {
    const success = await this.modalCoordinator.submitAddMember();
    if (success) this.closeAddMembersModal();
  }

  /**
   * Handles input in add member field
   * @param value - Input value
   */
  onAddMemberInput(value: string): void {
    this.modalCoordinator.onAddMemberInput(value);
  }

  /**
   * Selects a member from add member suggestions
   * @param u - User to add
   */
  selectAddMember(u: UserMini): void {
    this.modalCoordinator.selectAddMember(u);
  }

  /**
   * Handles click on a member in the members list
   * @param userId - ID of clicked user
   */
  onMemberClick(userId: string): void {
    this.closeMembersModal();
    this.openUserProfileModal(userId);
  }

  /**
   * Opens the user profile modal
   * @param userIdFromList - Optional user ID to display
   */
  async openUserProfileModal(userIdFromList?: string): Promise<void> {
    await this.modalCoordinator.openUserProfileModal(userIdFromList);
  }

  /**
   * Closes the user profile modal
   */
  closeUserProfileModal(): void {
    this.modalCoordinator.closeUserProfileModal();
  }

  /**
   * Opens a direct message with the profile user
   */
  onUserProfileMessageClick(): void {
    const targetId = this.state.userProfileId;
    if (!targetId || targetId === this.state.currentUser?.id) {
      this.closeUserProfileModal();
      return;
    }

    this.closeUserProfileModal();
    this.router.navigate(['/dm', targetId]);
  }

  /**
   * Toggles the edit menu for a message
   * @param ev - Mouse event
   * @param m - Message
   */
  toggleEditMenu(ev: MouseEvent, m: any): void {
    const result = this.editMenu.toggleEditMenu(ev, m, this.state.editMenuForId, this.state.editingMessageId, this.state.currentUser?.id ?? null);
    if (result) {
      this.state.editMenuForId = result.editMenuForId;
      this.state.editMenuPos = result.editMenuPos;
      this.state.messageEmojiForId = null;
      this.state.showEmoji = false;
      this.state.showMembers = false;
    } else {
      this.state.editMenuForId = null;
    }
  }

  /**
   * Handles mouse leaving a message row
   * @param messageId - ID of the message
   */
  onMessageRowLeave(messageId: string): void {
    const result = this.uiState.onMessageRowLeave(messageId, this.state.editMenuForId, this.state.messageEmojiForId, this.state.emojiOpenedFrom);
    this.state.editMenuForId = result.editMenuForId;
    this.state.messageEmojiForId = result.messageEmojiForId;
  }

  /**
   * Handles mouse leaving message row but keeps emoji open
   * @param messageId - ID of the message
   */
  onMessageRowLeaveKeepEmoji(messageId: string): void {
    const result = this.uiState.onMessageRowLeaveKeepEmoji(messageId, this.state.editMenuForId);
    this.state.editMenuForId = result.editMenuForId;
  }

  /**
   * Closes all open popovers and menus
   */
  closeAllPopovers(): void {
    const result = this.uiState.closeAllPopovers();
    this.state.showEmoji = result.showEmoji;
    this.state.showMembers = result.showMembers;
    this.state.messageEmojiForId = result.messageEmojiForId;
    this.state.editMenuForId = result.editMenuForId;
  }

  /**
   * Wrapper to close all popovers
   */
  closePopovers(): void {
    this.closeAllPopovers();
  }

  /**
   * Handles document click to close emoji popover
   * @param ev - Mouse event
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (this.emojiCoordinator.shouldCloseOnDocumentClick(ev)) {
      this.emojiCoordinator.closeMessageEmojiPopover();
    }
  }

  /**
   * Handles window scroll to close emoji popover
   */
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (this.emojiCoordinator.shouldCloseOnScrollOrTouch()) {
      this.emojiCoordinator.closeMessageEmojiPopover();
    }
  }

  /**
   * Handles touch move to close emoji popover
   */
  @HostListener('window:touchmove', [])
  onTouchMove(): void {
    if (this.emojiCoordinator.shouldCloseOnScrollOrTouch()) {
      this.emojiCoordinator.closeMessageEmojiPopover();
    }
  }

  /**
   * Handles input in 'To' field for new messages
   * @param v - Input value
   */
  onToInput(v: string): void {
    const result = this.compose.onToInput(v, this.state.getToInput$());
    this.state.to = result.to;
    this.state.suggestOpen = result.suggestOpen;
    this.state.composeTarget = result.composeTarget;
  }

  /**
   * Handles keyboard navigation in 'To' field suggestions
   * @param ev - Keyboard event
   * @param list - List of suggestions
   */
  onToKeydown(ev: KeyboardEvent, list: SuggestItem[] | null | undefined): void {
    const result = this.compose.onToKeydown(ev, list, this.state.suggestIndex, this.state.suggestOpen);
    if (!result) return;
    this.state.suggestIndex = result.suggestIndex;
    if (result.suggestOpen !== undefined) this.state.suggestOpen = result.suggestOpen;
    if (result.pickSuggestion) this.pickSuggestion(result.pickSuggestion);
  }

  /**
   * Handles click on suggestion item
   * @param ev - Mouse event
   * @param s - Suggestion item
   */
  onSuggestionClick(ev: MouseEvent, s: SuggestItem): void {
    const result = this.compose.onSuggestionClick(ev, s, this.state.getToInput$());
    this.state.to = result.to;
    this.state.suggestOpen = result.suggestOpen;
    this.state.suggestIndex = result.suggestIndex;
    this.state.composeTarget = result.composeTarget;
  }

  /**
   * Handles blur event on 'To' field
   */
  onToBlur(): void {
    setTimeout(() => {
      const result = this.compose.onToBlur();
      this.state.suggestOpen = result.suggestOpen;
      this.state.suggestIndex = result.suggestIndex;
    }, 120);
  }

  /**
   * Picks a suggestion and sets it as compose target
   * @param s - Suggestion item
   */
  pickSuggestion(s: SuggestItem): void {
    const result = this.compose.pickSuggestion(s, this.state.getToInput$());
    this.state.to = result.to;
    this.state.suggestOpen = result.suggestOpen;
    this.state.suggestIndex = result.suggestIndex;
    this.state.composeTarget = result.composeTarget;
  }

  /**
   * Returns placeholder text for compose input
   * @param vm - View model
   * @returns Placeholder text
   */
  composePlaceholder(vm: Vm): string {
    return this.compose.composePlaceholder(vm);
  }

  /**
   * Opens 'To' field suggestions with @ prefix
   */
  private openToSuggestWithAt(): void {
    const result = this.compose.openToSuggestWithAt(this.state.getToInput$(), this.refs.toInputEl?.nativeElement);
    this.state.to = result.to;
    this.state.suggestOpen = result.suggestOpen;
    this.state.suggestIndex = result.suggestIndex;
    this.state.composeTarget = result.composeTarget;
  }

  /**
   * Toggles members mention popup
   * @param evt - Optional event
   */
  toggleMembers(evt?: Event): void {
    evt?.stopPropagation();
    const result = this.mention.toggleMembers(this.state.showMembers, this.state.showEmoji, this.state.composeMode);
    if (result.shouldOpenCompose) {
      this.openToSuggestWithAt();
      return;
    }
    this.state.showMembers = result.showMembers;
    this.state.showEmoji = result.showEmoji;
  }

  /**
   * Closes members mention popup
   */
  closeMembers(): void {
    this.state.showMembers = this.mention.closeMembers();
  }

  /**
   * Inserts a mention into the draft
   * @param m - Member to mention
   */
  insertMention(m: MemberVM): void {
    this.state.draft = this.mention.insertMention(m, this.state.draft);
    this.state.showMembers = false;
  }

  /**
   * Opens thread for a message
   * @param m - Message object
   * @param vm - View model
   */
  async openThread(m: any, vm: any): Promise<void> {
    await this.thread.openThread(m, vm);
  }

  /**
   * Handles Enter key in composer to send message
   * @param event - Keyboard event
   * @param vm - Optional view model
   */
  onComposerKeydown(event: KeyboardEvent, vm?: Vm): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (vm) {
        this.send(vm);
      } else {
        this.sendFromCompose();
      }
    }
  }
}
