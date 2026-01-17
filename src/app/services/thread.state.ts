import { Injectable, inject, signal } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from '@angular/fire/firestore';
import { Message, Reaction, ReplyDoc, ThreadVM } from '../interfaces/allInterfaces.interface';


@Injectable({ providedIn: 'root' })
export class ThreadState {
  private fs = inject(Firestore);
  private auth = inject(Auth);

  private _vm = signal<ThreadVM>({ open: false, replies: [] });
  vm = this._vm.asReadonly();

  private unsubscribeReplies: Unsubscribe | null = null;

  constructor() {
    // ✅ Wenn ausgeloggt -> alle Listener stoppen (sonst Permission Error)
    authState(this.auth).subscribe((u) => {
      if (!u) this.close();
    });
  }

  openThread(opts: {
    channelId: string;
    header?: ThreadVM['header'];
    root: Message;
  }) {
    this.stopRepliesListener();

    this._vm.set({
      open: true,
      channelId: opts.channelId,
      header: opts.header,
      root: opts.root,
      replies: [],
    });

    const messageId = opts.root?.id;
    if (!messageId) return;

    const repliesRef = collection(
      this.fs,
      `channels/${opts.channelId}/messages/${messageId}/replies`
    );

    const q = query(repliesRef, orderBy('createdAt', 'asc'));

    this.unsubscribeReplies = onSnapshot(
      q,
      (snap) => {
        const replies: Message[] = snap.docs.map((d) => {
          const raw = d.data() as ReplyDoc;

          return {
            id: d.id,
            author: {
              id: raw.authorId ?? '',
              name: raw.authorName ?? 'Unbekannt',
              avatarUrl:
                raw.authorAvatar ??
                '/public/images/avatars/avatar-default.svg',
            },
            text: raw.text ?? '',
            createdAt: this.toDateOrString(raw.createdAt),
            reactions: this.mapReactions(raw.reactions),
          };
        });

        // ✅ falls zwischenzeitlich geschlossen wurde
        const v = this._vm();
        if (!v.open) return;

        this._vm.set({ ...v, replies });
      },
      (err) => {
        // ✅ Permission Errors beim Logout abfangen und clean schließen
        console.error('[ThreadState] Replies listener error:', err);
        this.close();
      }
    );
  }

  close() {
    this.stopRepliesListener();
    this._vm.set({ open: false, replies: [] });
  }

  private stopRepliesListener() {
    if (this.unsubscribeReplies) {
      this.unsubscribeReplies();
      this.unsubscribeReplies = null;
    }
  }

  private toDateOrString(ts: any): Date | string {
    try {
      if (ts && typeof ts.toDate === 'function') return ts.toDate();
    } catch { }
    return ts ?? '';
  }

  private mapReactions(reactions: any): Reaction[] | undefined {
    if (!reactions) return undefined;

    if (typeof reactions === 'object' && !Array.isArray(reactions)) {
      return Object.entries(reactions).map(([emoji, count]) => ({
        emoji,
        count: Number(count ?? 0),
      }));
    }

    if (Array.isArray(reactions)) return reactions as Reaction[];
    return undefined;
  }
}
