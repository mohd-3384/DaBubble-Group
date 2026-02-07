import { Injectable, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, combineLatest, of } from 'rxjs';
import { switchMap, filter } from 'rxjs/operators';
import {
  ChannelDoc,
  DayGroup,
  MemberVM,
  MessageVm,
  SuggestItem,
  UserDoc,
  Vm,
  UserMini,
} from '../../../interfaces/allInterfaces.interface';
import { ThreadService } from '../../../services/thread.service';

// Helper imports
import { MessageDataHelper } from './message-data.helper';
import { UserDataHelper } from './user-data.helper';
import { MemberDataHelper } from './member-data.helper';
import { ChannelDataHelper } from './channel-data.helper';
import { MessageGroupHelper } from './message-group.helper';
import { SuggestHelper } from './suggest.helper';
import { ThreadHelper } from './thread.helper';
import { ViewModelHelper } from './view-model.helper';
import { ChatStateHelper } from './chat-state.helper';

/**
 * Initializes and manages all observable streams for chat
 * Reduces constructor complexity in main component
 */
@Injectable()
export class ChatStreamsHelper {
  private route = inject(ActivatedRoute);
  private fs = inject(Firestore);
  private auth = inject(Auth);
  private thread = inject(ThreadService);

  private messageDataHelper = inject(MessageDataHelper);
  private userDataHelper = inject(UserDataHelper);
  private memberDataHelper = inject(MemberDataHelper);
  private channelDataHelper = inject(ChannelDataHelper);
  private messageGroupHelper = inject(MessageGroupHelper);
  private suggestHelper = inject(SuggestHelper);
  private threadHelper = inject(ThreadHelper);
  private vmHelper = inject(ViewModelHelper);
  private state = inject(ChatStateHelper);

  /**
   * Initializes all data streams
   * Call once in component constructor
   */
  initializeStreams(): {
    composeMode$: Observable<boolean>;
    vm$: Observable<Vm>;
    messages$: Observable<MessageVm[]>;
    groups$: Observable<DayGroup[]>;
    isEmpty$: Observable<boolean>;
    members$: Observable<MemberVM[]>;
    channelDoc$: Observable<ChannelDoc | null>;
    channelCreator$: Observable<UserDoc | null>;
    usersAll$: Observable<UserMini[]>;
    channelsAll$: Observable<{ id: string; name: string }[]>;
    suggestions$: Observable<SuggestItem[]>;
    addMemberSuggestions$: Observable<UserMini[]>;
  } {
    // Compose mode stream
    const composeMode$ = this.vmHelper.getComposeMode$();
    composeMode$.subscribe((isCompose) => {
      this.state.composeMode = isCompose;
    });

    // View model stream
    const vm$ = this.vmHelper.getVm$(composeMode$);

    // Users stream
    const usersAll$ = this.userDataHelper.getAllUsers$();

    // Members stream
    const members$ = this.memberDataHelper.getMembers$(usersAll$);

    // Add member suggestions
    const addMemberSuggestions$ = this.memberDataHelper.getAddMemberSuggestions$(
      usersAll$,
      members$,
      this.state.getAddMemberInput$()
    );

    // Messages stream
    const baseMessages$ = this.messageDataHelper.getMessages$(usersAll$);
    const messages$: Observable<MessageVm[]> = composeMode$.pipe(
      switchMap((isCompose) => (isCompose ? of([]) : baseMessages$))
    );

    // Day groups
    const groups$ = this.messageGroupHelper.getGroups$(messages$);

    // Channel doc stream
    const channelDoc$ = this.channelDataHelper.getChannelDoc$();

    // Channel creator stream
    const channelCreator$ = this.channelDataHelper.getChannelCreator$(channelDoc$);

    // Subscribe to channel topic
    channelDoc$.subscribe((ch) => {
      this.state.channelTopic = ch?.topic ?? '';
    });

    // Empty state stream
    const baseIsEmpty$ = this.channelDataHelper.getIsEmpty$(channelDoc$);
    const isEmpty$: Observable<boolean> = composeMode$.pipe(
      switchMap((isCompose) => (isCompose ? of(true) : baseIsEmpty$))
    );

    // All channels
    const channelsAll$ = this.suggestHelper.getChannelsAll$();

    // Suggestions stream
    const suggestions$ = this.suggestHelper.getSuggestions$(
      this.state.getToInput$(),
      channelsAll$,
      usersAll$
    );

    return {
      composeMode$,
      vm$,
      messages$,
      groups$,
      isEmpty$,
      members$,
      channelDoc$,
      channelCreator$,
      usersAll$,
      channelsAll$,
      suggestions$,
      addMemberSuggestions$,
    };
  }

  /**
   * Initializes current user subscriptions
   */
  initializeCurrentUser(): void {
    this.userDataHelper.getCurrentUser$().subscribe((u) => {
      this.state.currentUser = u;
    });

    this.userDataHelper
      .getUserNameMap$(this.userDataHelper.getAllUsers$())
      .subscribe((map) => {
        this.state.setUserNameMap(map);
      });
  }

  /**
   * Initializes thread from route parameters (mobile)
   */
  initializeThreadFromRoute(vm$: Observable<Vm>): void {
    combineLatest([this.route.paramMap, vm$, authState(this.auth)])
      .pipe(
        switchMap(([params, vm, authUser]) => {
          const threadId = params.get('threadId');
          const id = params.get('id');
          if (!threadId || !id) return [null] as any;
          return this.threadHelper
            .handleThreadFromRoute(threadId, id, vm, authUser)
            .then((result) => result);
        }),
        filter((x): x is any => !!x)
      )
      .subscribe(({ vm, msg, channelId, isDM }) => {
        this.thread.openThread({
          channelId,
          header: { title: 'Thread', channel: vm.title },
          root: {
            id: msg.id,
            author: {
              id: msg.authorId,
              name: msg.authorName,
              avatarUrl: msg.authorAvatar,
            },
            text: msg.text,
            createdAt: msg.createdAt,
          },
          isDM,
        });
      });
  }
}
