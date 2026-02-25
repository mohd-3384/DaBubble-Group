import { Component, computed, effect, inject, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, ActivatedRoute, ParamMap, Router, NavigationStart, NavigationEnd } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { ChannelsComponent } from '../../components/channels/channels.component';
import { ThreadComponent } from '../../components/thread/thread.component';
import { ThreadService } from '../../services/thread.service';
import { ChatRefreshService } from '../../services/chat-refresh.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of, Subscription } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, startWith, switchMap } from 'rxjs/operators';
import { MentionUser, UserDoc } from '../../interfaces/allInterfaces.interface';
import { PresenceService } from '../../services/presence.service';
import { ChannelService } from '../../services/channel.service';
import { ChannelJoinNoticeService } from '../../services/channel-join-notice.service';
import { ShellThreadHelper } from './helpers/shell-thread.helper';
import { ShellNavigationHelper } from './helpers/shell-navigation.helper';
import { ShellUserHelper } from './helpers/shell-user.helper';

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
export class ShellComponent implements OnDestroy {
  private thread = inject(ThreadService);
  private chatRefresh = inject(ChatRefreshService);
  vm = computed(() => this.thread.vm());

  private fs = inject(Firestore);
  private route = inject(ActivatedRoute);
  private auth = inject(Auth);
  private presence = inject(PresenceService);
  private channelService = inject(ChannelService);
  private joinNotice = inject(ChannelJoinNoticeService);
  private threadHelper = inject(ShellThreadHelper);
  private navHelper = inject(ShellNavigationHelper);
  private userHelper = inject(ShellUserHelper);

  users$ = collectionData(collection(this.fs, 'users'), { idField: 'id' }) as Observable<MentionUser[]>;

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

  currentUser: (UserDoc & { id: string }) | null = null;

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

  /**
   * Initializes the shell component.
   * Sets up mobile view handling, presence service, and subscribes to router events,
   * user mentions, channel ID, and current user data.
   * @param router - Angular router for navigation tracking
   */
  constructor(
    private router: Router
  ) {
    this.initializeMobileView();
    this.initializeRouterSubscription();
    this.initializeServices();
    this.initializeSubscriptions();
    this.initializeJoinNotice();
  }

  ngOnDestroy(): void {
    this.joinNoticeSub?.unsubscribe();
    if (this.joinSnackbarTimer) {
      clearTimeout(this.joinSnackbarTimer);
    }
  }

  /**
   * Initializes mobile view based on current URL
   */
  private initializeMobileView() {
    this.mobileView = this.navHelper.getMobileView(this.router.url);
  }

  /**
   * Initializes router event subscription for mobile view updates
   */
  private initializeRouterSubscription() {
    this.router.events
      .pipe(filter((e): e is NavigationStart | NavigationEnd =>
        e instanceof NavigationStart || e instanceof NavigationEnd))
      .subscribe((e) => this.handleRouterEvent(e));
  }

  /**
   * Initializes presence service and thread state effect
   */
  private initializeServices() {
    this.presence.init();
    effect(() => {
      this.shellThreadOpen = !!this.vm().open;
    });
  }

  /**
   * Initializes all data subscriptions (users, channelId, currentUser)
   */
  private initializeSubscriptions() {
    this.usersAllForMentions$.subscribe(list => (this.usersAllForMentions = list));
    this.channelId$.subscribe(id => (this.channelId = id));
    this.userHelper.getCurrentUserStream().subscribe(u => (this.currentUser = u));
  }

  private initializeJoinNotice(): void {
    this.joinNoticeSub = this.joinNotice.notice$.subscribe(() => {
      this.showJoinSnackbar = true;
      if (this.joinSnackbarTimer) {
        clearTimeout(this.joinSnackbarTimer);
      }
      this.joinSnackbarTimer = setTimeout(() => {
        this.showJoinSnackbar = false;
      }, 2600);
    });
  }

  /**
   * Handles router navigation events
   * @param e - Navigation event (NavigationStart or NavigationEnd)
   */
  private handleRouterEvent(e: NavigationStart | NavigationEnd) {
    const url = this.navHelper.getEventUrl(e);
    this.mobileView = this.navHelper.getMobileView(url);
  }

  workspaceCollapsed = false;
  shellThreadOpen = false;
  showJoinSnackbar = false;
  private joinNoticeSub?: Subscription;
  private joinSnackbarTimer?: ReturnType<typeof setTimeout>;

  /**
   * Toggles the workspace sidebar collapsed state.
   */
  toggleWorkspace() {
    this.workspaceCollapsed = !this.workspaceCollapsed;
  }

  /**
   * Handles workspace collapsed state changes from child components.
   * @param collapsed - Whether the workspace should be collapsed
   */
  onWorkspaceCollapsedChange(collapsed: boolean) {
    this.workspaceCollapsed = collapsed;
  }

  /**
   * Creates a deterministic conversation ID from two user IDs.
   * Always returns IDs in alphabetical order to ensure consistency.
   * @param a - First user ID
   * @param b - Second user ID
   * @returns Conversation ID in format "userId1_userId2"
   */
  private makeConvId(a: string, b: string): string {
    return a < b ? `${a}_${b}` : `${b}_${a}`;
  }

  /**
   * Sends a thread reply message to Firestore.
   * Updates the parent message's reply count and last reply timestamp.
   * Supports both channel messages and direct messages.
   * @param text - The reply text to send
   */
  async onSend(text: string) {
    const msg = (text || '').trim();
    if (!msg) return;
    const vm = this.thread.vm();
    if (!this.threadHelper.validateThreadState(vm)) return;
    const channelId = vm.channelId;
    if (!this.threadHelper.validateChannelId(channelId)) return;
    const messageId = vm.root!.id;
    const isDM = vm.isDM ?? false;
    const authUser = this.auth.currentUser;
    if (!this.threadHelper.validateAuthUser(authUser)) return;
    if (!isDM) {
      const isMember = await this.channelService.isCurrentUserMember(channelId!);
      if (!isMember) {
        this.joinNotice.trigger();
        return;
      }
    }
    const authorData = this.threadHelper.getAuthorData(authUser, this.currentUser);
    await this.threadHelper.saveReply(msg, channelId!, messageId, isDM, authorData);
  }

  /**
   * Closes the thread panel.
   * On mobile devices, switches view back to chat.
   */
  onClose() {
    this.thread.close();
    if (window.innerWidth <= 1024) {
      this.mobileView = 'chat';
    }
  }

  /**
   * Edits a thread message (either root message or reply).
   * Updates the message text and sets editedAt timestamp.
   * Refreshes chat messages if editing the root message.
   * @param ev - Event containing messageId and new text
   */
  async onEditThreadMessage(ev: { messageId: string; text: string }) {
    const vm = this.thread.vm();
    if (!vm?.open || !vm.root?.id) return;
    const channelId = this.channelId;
    if (!channelId) return;
    const rootId = vm.root.id;
    const isDM = this.router.url.includes('/dm/');
    await this.threadHelper.editMessage(ev, channelId, rootId, isDM, (a, b) => this.makeConvId(a, b));
  }
}
