import { Injectable, signal } from '@angular/core';

export interface UserMeta { id: string; name: string; avatarUrl?: string; }
export interface Reaction { emoji: string; count: number; }
export interface Message { id: string; author: UserMeta; text: string; createdAt: Date | string; reactions?: Reaction[]; }
export interface ThreadVM {
  open: boolean;
  header?: { title: string; channel?: string };
  root?: Message;
  replies: Message[];
}

@Injectable({ providedIn: 'root' })
export class ThreadState {
  private _vm = signal<ThreadVM>({ open: false, replies: [] });
  vm = this._vm.asReadonly();

  openThread(opts: { header?: ThreadVM['header']; root: Message; replies?: Message[] }) {
    this._vm.set({ open: true, header: opts.header, root: opts.root, replies: opts.replies ?? [] });
  }

  appendReply(text: string, me: UserMeta) {
    const v = this._vm();
    if (!v.open) return;
    const reply: Message = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      author: me,
      text,
      createdAt: new Date()
    };
    this._vm.set({ ...v, replies: [...v.replies, reply] });
  }

  close() { this._vm.set({ open: false, replies: [] }); }
}
