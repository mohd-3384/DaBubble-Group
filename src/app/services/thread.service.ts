import { Injectable, inject, signal } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  onSnapshot,
  Unsubscribe,
  collection,
  query,
  orderBy,
  getDoc,
} from '@angular/fire/firestore';
import { Message, ReplyDoc, ThreadVM } from '../interfaces/allInterfaces.interface';

/**
 * Service for managing thread state with real-time Firestore listeners
 * Handles opening/closing threads, syncing root message and replies
 */
@Injectable({ providedIn: 'root' })
export class ThreadService {
  private fs = inject(Firestore);
  private auth = inject(Auth);

  /**
   * Internal signal holding the current thread view model
   */
  private _vm = signal<ThreadVM>({ open: false, replies: [] });

  /**
   * Read-only signal exposing the current thread state
   */
  vm = this._vm.asReadonly();

  private unsubscribeReplies: Unsubscribe | null = null;
  private unsubscribeRoot: Unsubscribe | null = null;

  constructor() {
    // Stop all listeners when user logs out to prevent permission errors
    authState(this.auth).subscribe((u) => {
      if (!u) this.close();
    });
  }

  /**
   * Opens a thread and sets up real-time listeners for root message and replies
   * @param opts - Thread options including channelId, header, root message, and isDM flag
   */
  openThread(opts: {
    channelId: string;
    header?: ThreadVM['header'];
    root: Message;
    isDM?: boolean;
  }) {
    const isDM = opts.isDM ?? false;
    this.stopAllListeners();
    const rootId = opts.root?.id;
    if (!rootId) return;
    this.initializeThreadState(opts, isDM);
    this.setupRootListener(opts.channelId, rootId, isDM);
    this.setupRepliesListener(opts.channelId, rootId, isDM);
  }

  /**
   * Initializes the thread state with provided options
   * @param opts - Thread options
   * @param isDM - Whether this is a direct message thread
   */
  private initializeThreadState(opts: any, isDM: boolean) {
    this._vm.set({
      open: true,
      channelId: opts.channelId,
      header: opts.header,
      root: opts.root,
      replies: [],
      isDM: isDM,
    });
  }

  /**
   * Sets up real-time listener for the root message
   * @param channelId - Channel or conversation ID
   * @param rootId - Root message ID
   * @param isDM - Whether this is a direct message
   */
  private setupRootListener(channelId: string, rootId: string, isDM: boolean) {
    const rootRef = isDM
      ? doc(this.fs, `conversations/${channelId}/messages/${rootId}`)
      : doc(this.fs, `channels/${channelId}/messages/${rootId}`);
    this.unsubscribeRoot = onSnapshot(
      rootRef,
      (snap) => this.handleRootSnapshot(snap, rootId),
      (err) => this.handleRootError(err)
    );
  }

  /**
   * Handles snapshot updates for the root message
   * @param snap - Firestore document snapshot
   * @param rootId - Root message ID
   */
  private handleRootSnapshot(snap: any, rootId: string) {
    if (!snap.exists()) {
      console.warn('[ThreadService] Root doc does not exist');
      return;
    }
    const raw: any = snap.data();
    const v = this._vm();
    if (!v.open) return;
    const nextRoot = this.buildMessageFromSnapshot(raw, rootId, v.root);
    this._vm.set({ ...v, root: nextRoot });
  }

  /**
   * Builds a Message object from Firestore snapshot data
   * @param raw - Raw Firestore data
   * @param id - Message ID
   * @param fallback - Fallback message for missing data
   * @returns Constructed Message object
   */
  private buildMessageFromSnapshot(raw: any, id: string, fallback?: Message): Message {
    return {
      id,
      author: {
        id: raw?.authorId ?? fallback?.author?.id ?? '',
        name: raw?.authorName ?? fallback?.author?.name ?? 'Unbekannt',
        avatarUrl:
          raw?.authorAvatar ??
          fallback?.author?.avatarUrl ??
          '/public/images/avatars/avatar-default.svg',
      },
      text: raw?.text ?? fallback?.text ?? '',
      createdAt: this.toDateOrString(raw?.createdAt ?? fallback?.createdAt),
      reactions: this.ensureReactionsMap(raw?.reactions),
      reactionBy: this.ensureReactionBy(raw?.reactionBy),
    };
  }

  /**
   * Handles errors from the root message listener
   * @param err - Error object
   */
  private handleRootError(err: any) {
    console.error('[ThreadService] Root listener error:', err);
    this.close();
  }

  /**
   * Sets up real-time listener for thread replies
   * @param channelId - Channel or conversation ID
   * @param rootId - Root message ID
   * @param isDM - Whether this is a direct message
   */
  private setupRepliesListener(channelId: string, rootId: string, isDM: boolean) {
    const repliesRef = isDM
      ? collection(this.fs, `conversations/${channelId}/messages/${rootId}/replies`)
      : collection(this.fs, `channels/${channelId}/messages/${rootId}/replies`);
    const q = query(repliesRef, orderBy('createdAt', 'asc'));
    this.unsubscribeReplies = onSnapshot(
      q,
      (snap) => this.handleRepliesSnapshot(snap),
      (err) => this.handleRepliesError(err)
    );
  }

  /**
   * Handles snapshot updates for thread replies
   * @param snap - Firestore query snapshot
   */
  private handleRepliesSnapshot(snap: any) {
    const replies: Message[] = snap.docs.map((d: any) => {
      const raw = d.data() as ReplyDoc & any;
      return {
        id: d.id,
        author: {
          id: raw.authorId ?? '',
          name: raw.authorName ?? 'Unbekannt',
          avatarUrl:
            raw.authorAvatar ?? '/public/images/avatars/avatar-default.svg',
        },
        text: raw.text ?? '',
        createdAt: this.toDateOrString(raw.createdAt),
        reactions: this.ensureReactionsMap(raw.reactions),
        reactionBy: this.ensureReactionBy(raw.reactionBy),
      };
    });
    const v = this._vm();
    if (!v.open) return;
    this._vm.set({ ...v, replies });
  }

  /**
   * Handles errors from the replies listener
   * @param err - Error object
   */
  private handleRepliesError(err: any) {
    console.error('[ThreadService] Replies listener error:', err);
    this.close();
  }

  /**
   * Closes the thread and cleans up all Firestore listeners
   */
  close() {
    this.stopAllListeners();
    this._vm.set({ open: false, replies: [] });
  }

  /**
   * Unsubscribes from all active Firestore listeners
   */
  private stopAllListeners() {
    if (this.unsubscribeReplies) {
      this.unsubscribeReplies();
      this.unsubscribeReplies = null;
    }
    if (this.unsubscribeRoot) {
      this.unsubscribeRoot();
      this.unsubscribeRoot = null;
    }
  }

  /**
   * Converts a Firestore timestamp to a Date or returns the value as-is
   * @param ts - Firestore timestamp or date value
   * @returns Date object or original value
   */
  private toDateOrString(ts: any): Date | string {
    try {
      if (ts && typeof ts.toDate === 'function') return ts.toDate();
    } catch { }
    return ts ?? '';
  }

  /**
   * Normalizes reaction data into a consistent emoji -> count map
   * Handles both array and object formats from Firestore
   * @param raw - Raw reaction data from Firestore
   * @returns Record mapping emoji strings to reaction counts
   */
  private ensureReactionsMap(raw: any): Record<string, number> {
    if (!raw) return {};
    if (Array.isArray(raw)) {
      return this.reactionsFromArray(raw);
    }
    if (typeof raw === 'object') {
      return this.reactionsFromObject(raw);
    }
    return {};
  }

  /**
   * Converts array-formatted reactions to emoji -> count map
   * @param arr - Array of reaction objects
   * @returns Record mapping emojis to counts
   */
  private reactionsFromArray(arr: any[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const it of arr) {
      const emoji = this.emojiToString((it as any)?.emoji);
      const count = Number((it as any)?.count ?? 0);
      if (emoji && Number.isFinite(count) && count > 0) out[emoji] = count;
    }
    return out;
  }

  /**
   * Converts object-formatted reactions to emoji -> count map
   * @param obj - Object with emoji keys and count values
   * @returns Record mapping emojis to counts
   */
  private reactionsFromObject(obj: any): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      const emoji = this.emojiToString(k);
      const count = Number(v ?? 0);
      if (emoji && Number.isFinite(count) && count > 0) out[emoji] = count;
    }
    return out;
  }

  /**
   * Ensures reactionBy data is in the correct format
   * @param raw - Raw reactionBy data from Firestore
   * @returns Nested record mapping emoji -> userId -> boolean
   */
  private ensureReactionBy(raw: any): Record<string, Record<string, boolean>> {
    if (!raw || typeof raw !== 'object') return {};
    return raw as Record<string, Record<string, boolean>>;
  }

  /**
   * Converts various emoji formats to a string representation
   * @param x - Emoji object or string from emoji picker
   * @returns Emoji as string or empty string if invalid
   */
  private emojiToString(x: any): string {
    if (typeof x === 'string') return x;
    const native = x?.native ?? x?.emoji?.native ?? x?.emoji?.colons;
    if (typeof native === 'string') return native;
    const s = String(x ?? '');
    return s === '[object Object]' ? '' : s;
  }

  /**
   * Manually refreshes the root message from Firestore
   * Used after editing the root message to ensure thread displays latest data
   */
  async refreshRootMessage() {
    const v = this._vm();
    if (!v.open || !v.root?.id || !v.channelId) return;
    try {
      const rootRef = this.getRootRef(v.channelId, v.root.id, v.isDM);
      const snap = await getDoc(rootRef);
      if (snap.exists()) {
        this.updateRootFromSnapshot(snap, v);
      }
    } catch (err) {
      console.error('[ThreadService] Error refreshing root message:', err);
    }
  }

  /**
   * Gets the Firestore reference for the root message
   * @param channelId - Channel or conversation ID
   * @param rootId - Root message ID
   * @param isDM - Whether this is a direct message
   * @returns Firestore document reference
   */
  private getRootRef(channelId: string, rootId: string, isDM?: boolean) {
    return isDM
      ? doc(this.fs, `conversations/${channelId}/messages/${rootId}`)
      : doc(this.fs, `channels/${channelId}/messages/${rootId}`);
  }

  /**
   * Updates the root message state from a Firestore snapshot
   * @param snap - Firestore document snapshot
   * @param v - Current thread view model state
   */
  private updateRootFromSnapshot(snap: any, v: ThreadVM) {
    const raw: any = snap.data();
    const nextRoot = this.buildMessageFromSnapshot(raw, v.root!.id, v.root);
    this._vm.set({ ...v, root: nextRoot });
  }
}
