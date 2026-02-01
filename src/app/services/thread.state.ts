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
export class ThreadState {
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

    this._vm.set({
      open: true,
      channelId: opts.channelId,
      header: opts.header,
      root: opts.root,
      replies: [],
      isDM: isDM,
    });

    const rootRef = isDM
      ? doc(this.fs, `conversations/${opts.channelId}/messages/${rootId}`)
      : doc(this.fs, `channels/${opts.channelId}/messages/${rootId}`);

    this.unsubscribeRoot = onSnapshot(
      rootRef,
      (snap) => {
        if (!snap.exists()) {
          console.warn('[ThreadState] Root doc does not exist');
          return;
        }

        const raw: any = snap.data();
        const v = this._vm();
        if (!v.open) return;

        const nextRoot: Message = {
          id: rootId,
          author: {
            id: raw?.authorId ?? v.root?.author?.id ?? '',
            name: raw?.authorName ?? v.root?.author?.name ?? 'Unbekannt',
            avatarUrl:
              raw?.authorAvatar ??
              v.root?.author?.avatarUrl ??
              '/public/images/avatars/avatar-default.svg',
          },
          text: raw?.text ?? v.root?.text ?? '',
          createdAt: this.toDateOrString(raw?.createdAt ?? v.root?.createdAt),
          reactions: this.ensureReactionsMap(raw?.reactions),
          reactionBy: this.ensureReactionBy(raw?.reactionBy),
        };

        this._vm.set({ ...v, root: nextRoot });
      },
      (err) => {
        console.error('[ThreadState] Root listener error:', err);
        this.close();
      }
    );

    const repliesRef = isDM
      ? collection(this.fs, `conversations/${opts.channelId}/messages/${rootId}/replies`)
      : collection(this.fs, `channels/${opts.channelId}/messages/${rootId}/replies`);
    const q = query(repliesRef, orderBy('createdAt', 'asc'));

    this.unsubscribeReplies = onSnapshot(
      q,
      (snap) => {
        const replies: Message[] = snap.docs.map((d) => {
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
      },
      (err) => {
        console.error('[ThreadState] Replies listener error:', err);
        this.close();
      }
    );
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
      const out: Record<string, number> = {};
      for (const it of raw) {
        const emoji = this.emojiToString((it as any)?.emoji);
        const count = Number((it as any)?.count ?? 0);
        if (emoji && Number.isFinite(count) && count > 0) out[emoji] = count;
      }
      return out;
    }

    if (typeof raw === 'object') {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) {
        const emoji = this.emojiToString(k);
        const count = Number(v ?? 0);
        if (emoji && Number.isFinite(count) && count > 0) out[emoji] = count;
      }
      return out;
    }

    return {};
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
    if (!v.open || !v.root?.id) return;

    try {
      const rootRef = v.isDM
        ? doc(this.fs, `conversations/${v.channelId}/messages/${v.root.id}`)
        : doc(this.fs, `channels/${v.channelId}/messages/${v.root.id}`);
      const snap = await getDoc(rootRef);

      if (!snap.exists()) return;

      const raw: any = snap.data();

      const nextRoot: Message = {
        id: v.root.id,
        author: {
          id: raw?.authorId ?? v.root?.author?.id ?? '',
          name: raw?.authorName ?? v.root?.author?.name ?? 'Unbekannt',
          avatarUrl:
            raw?.authorAvatar ??
            v.root?.author?.avatarUrl ??
            '/public/images/avatars/avatar-default.svg',
        },
        text: raw?.text ?? v.root?.text ?? '',
        createdAt: this.toDateOrString(raw?.createdAt ?? v.root?.createdAt),
        reactions: this.ensureReactionsMap(raw?.reactions),
        reactionBy: this.ensureReactionBy(raw?.reactionBy),
      };

      this._vm.set({ ...v, root: nextRoot });
    } catch (err) {
      console.error('[ThreadState] Error refreshing root message:', err);
    }
  }
}
