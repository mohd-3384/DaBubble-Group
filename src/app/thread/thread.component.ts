import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { Message, ReactionVm } from '../interfaces/allInterfaces.interface';
import { deleteField, doc, Firestore, increment, runTransaction, updateDoc } from '@angular/fire/firestore';

type MentionUser = { id: string; name: string; avatarUrl?: string };

@Component({
  selector: 'app-thread',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerModule],
  templateUrl: './thread.component.html',
  styleUrls: ['./thread.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThreadComponent {
  constructor(private host: ElementRef<HTMLElement>, private fs: Firestore) { }

  @Input() header: { title: string; channel?: string } = { title: 'Thread' };
  @Input({ required: true }) rootMessage!: Message;
  @Input() replies: Message[] = [];
  @Input() users: MentionUser[] = [];
  @Input() currentUserId: string | null = null;
  @Input({ required: true }) channelId!: string;

  @Output() send = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<{ messageId: string; text: string }>();

  editingMessageId: string | null = null;
  editDraft = '';

  editMenuForId: string | null = null;

  // Composer
  draft = '';
  showEmoji = false;
  showUsers = false;

  // Message reaction picker (Hover actions)
  messageEmojiForId: string | null = null;
  emojiPopoverPos = { top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' };

  // ✅ Edit-box emoji picker
  editEmojiForId: string | null = null;
  editEmojiPopoverPos = { top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' };

  hoveredRowId: string | null = null;
  private popoverHoverForId: string | null = null;
  private leaveTimer: any = null;

  trackReaction = (_: number, it: ReactionVm) => it.emoji;
  trackReply = (_: number, r: Message) => r.id;
  trackUser = (_: number, u: MentionUser) => u.id;

  // nur schließen wenn Klick außerhalb des Thread-Components
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    const target = ev.target as Node | null;
    if (!target) return;
    if (this.host.nativeElement.contains(target)) return;
    this.closePopovers();
  }

  closePopovers() {
    this.showEmoji = false;
    this.showUsers = false;
    this.messageEmojiForId = null;
    this.editMenuForId = null;
    this.editEmojiForId = null;
    this.popoverHoverForId = null;
    this.hoveredRowId = null;
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
  }

  toggleEmoji(evt?: Event) {
    evt?.stopPropagation();
    this.showEmoji = !this.showEmoji;
    if (this.showEmoji) this.showUsers = false;
  }

  toggleUsers(evt?: Event) {
    evt?.stopPropagation();
    this.showUsers = !this.showUsers;
    if (this.showUsers) this.showEmoji = false;
  }

  insertMention(u: MentionUser) {
    const mention = `@${u.name}`;
    const base = this.draft || '';
    const needsSpace = base.length > 0 && !/\s$/.test(base);
    this.draft = base + (needsSpace ? ' ' : '') + mention + ' ';
    this.showUsers = false;
  }

  onSendClick(evt?: Event) {
    evt?.stopPropagation();
    const text = (this.draft || '').trim();
    if (!text) return;

    this.send.emit(text);
    this.draft = '';
    this.closePopovers();
  }

  isOwnMessage(m: { author?: { id?: string } } | null | undefined): boolean {
    return !!this.currentUserId && String(m?.author?.id ?? '') === this.currentUserId;
  }

  toggleEditMenu(ev: MouseEvent, m: Message) {
    ev.stopPropagation();
    if (!this.isOwnMessage(m)) return;
    if (this.editingMessageId === m.id) return;

    const willOpen = this.editMenuForId !== m.id;
    this.editMenuForId = willOpen ? m.id : null;

    if (willOpen) this.messageEmojiForId = null;

    this.showEmoji = false;
    this.showUsers = false;

    if (willOpen) this.hoveredRowId = m.id;
  }

  startEdit(m: Message) {
    if (!this.isOwnMessage(m)) return;

    this.editMenuForId = null;
    this.messageEmojiForId = null;
    this.showEmoji = false;
    this.showUsers = false;
    this.editEmojiForId = null;
    this.editingMessageId = m.id;
    this.editDraft = (m.text ?? '').toString();
  }

  cancelEdit(m?: Message) {
    const id = m?.id ?? this.editingMessageId ?? null;
    this.editingMessageId = null;
    this.editDraft = '';

    // ✅ edit picker schließen
    this.editEmojiForId = null;

    if (!id) return;

    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;

    if (this.hoveredRowId === id) this.hoveredRowId = null;
    if (this.popoverHoverForId === id) this.popoverHoverForId = null;

    if (this.editMenuForId === id) this.editMenuForId = null;
    if (this.messageEmojiForId === id) this.messageEmojiForId = null;
  }

  saveEdit(m: Message) {
    if (!this.isOwnMessage(m)) return;

    const next = (this.editDraft || '').trim();
    if (!next || next === (m.text ?? '').toString()) {
      this.cancelEdit(m);
      return;
    }

    this.edit.emit({ messageId: m.id, text: next });
    this.cancelEdit(m);
  }

  // ---------------------------
  // Hover/Active handling
  // ---------------------------
  onRowEnter(id: string) {
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
    this.hoveredRowId = id;
  }

  onRowLeave(id: string) {
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    if (this.hoveredRowId === id) this.hoveredRowId = null;

    this.leaveTimer = setTimeout(() => {
      const popoverOpen = this.editMenuForId === id || this.messageEmojiForId === id;
      const hoverPopover = this.popoverHoverForId === id;

      if (popoverOpen || hoverPopover) return;

      if (this.editMenuForId === id) this.editMenuForId = null;
      if (this.messageEmojiForId === id) this.messageEmojiForId = null;
    }, 100);
  }

  onPopoverEnter(id: string) {
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
    this.popoverHoverForId = id;
    this.hoveredRowId = id;
  }

  onPopoverLeave(id: string) {
    if (this.popoverHoverForId === id) this.popoverHoverForId = null;
    this.onRowLeave(id);
  }

  isRowActive(id: string) {
    const popoverOpen = this.editMenuForId === id || this.messageEmojiForId === id;
    const hoverRow = this.hoveredRowId === id;
    const hoverPopover = this.popoverHoverForId === id;
    return hoverRow || hoverPopover || popoverOpen;
  }

  // ---------------------------
  // Emoji picker (per message reactions)
  // ---------------------------
  toggleMessageEmojiPicker(ev: MouseEvent, messageId: string) {
    ev.stopPropagation();

    if (this.messageEmojiForId === messageId) {
      this.messageEmojiForId = null;
      return;
    }

    // wenn reaction-picker aufgeht: edit-menu & edit-picker zu
    this.editMenuForId = null;
    this.editEmojiForId = null;

    const btn = ev.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();

    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const viewportW = window.innerWidth || document.documentElement.clientWidth;

    const pickerHeight = 360;
    const pickerWidth = 360;
    const offset = 8;

    const roomBelow = viewportH - rect.bottom;
    const placement: 'top' | 'bottom' = roomBelow > pickerHeight + offset ? 'bottom' : 'top';

    const top = placement === 'bottom' ? rect.bottom + offset : rect.top - pickerHeight - offset;

    let left = rect.left;
    const maxLeft = viewportW - pickerWidth - 16;
    if (left > maxLeft) left = Math.max(16, maxLeft);

    this.messageEmojiForId = messageId;
    this.emojiPopoverPos = { top, left, placement };

    this.showEmoji = false;
    this.showUsers = false;

    this.hoveredRowId = messageId;
  }

  // ---------------------------
  // ✅ Emoji picker (Edit-Box -> Text einfügen)
  // ---------------------------
  toggleEditEmojiPicker(ev: MouseEvent, messageId: string) {
    ev.stopPropagation();

    // andere popovers zu
    this.showEmoji = false;
    this.showUsers = false;
    this.messageEmojiForId = null;
    this.editMenuForId = null;

    if (this.editEmojiForId === messageId) {
      this.editEmojiForId = null;
      return;
    }

    const btn = ev.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();

    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const viewportW = window.innerWidth || document.documentElement.clientWidth;

    const pickerHeight = 360;
    const pickerWidth = 360;
    const offset = 8;

    const roomBelow = viewportH - rect.bottom;
    const placement: 'top' | 'bottom' = roomBelow > pickerHeight + offset ? 'bottom' : 'top';

    const top = placement === 'bottom' ? rect.bottom + offset : rect.top - pickerHeight - offset;

    // lieber am Button ausrichten, aber clampen
    let left = rect.left;
    const maxLeft = viewportW - pickerWidth - 16;
    if (left > maxLeft) left = Math.max(16, maxLeft);

    this.editEmojiForId = messageId;
    this.editEmojiPopoverPos = { top, left, placement };
    this.hoveredRowId = messageId;
  }

  // Einfügen ins Edit-Textarea
  onEditEmojiSelect(e: any) {
    const emoji = this.emojiToString(e?.emoji?.native ?? e?.emoji ?? e);
    if (!emoji) return;

    const base = this.editDraft || '';
    this.editDraft = base + emoji;

    this.editEmojiForId = null;
  }

  onComposerEmojiSelect(e: any) {
    const emoji = this.emojiToString(e?.emoji?.native ?? e?.emoji ?? e);
    if (!emoji) return;

    const base = this.draft || '';
    this.draft = base + emoji;
    this.showEmoji = false;
  }

  closeMessageUiFromComposer() {
    // schließt nur Message-bezogene UI (Actions/Popover)
    this.editMenuForId = null;
    this.messageEmojiForId = null;

    // damit message-actions sofort verschwinden (isRowActive -> false)
    this.popoverHoverForId = null;
    this.hoveredRowId = null;

    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
  }

  private findMessageById(id: string): Message {
    if (this.rootMessage?.id === id) return this.rootMessage;
    const reply = this.replies.find((r) => r.id === id);
    if (!reply) throw new Error(`Message with id ${id} not found`);
    return reply;
  }

  onEmojiSelect(e: any) {
    const emoji = this.emojiToString(e?.emoji?.native ?? e?.emoji ?? e);
    if (!emoji || !this.messageEmojiForId) return;

    const msg = this.findMessageById(this.messageEmojiForId);
    const ctx = msg.id === this.rootMessage.id ? 'root' : 'reply';

    this.toggleReaction(msg, emoji, ctx);
    this.messageEmojiForId = null;
  }

  // ---------------------------
  // Reactions (UI)
  // ---------------------------
  reactionsFor(m: Message): ReactionVm[] {
    const raw = (m as any)?.reactions;

    if (!raw || typeof raw !== 'object') return [];

    const out: ReactionVm[] = [];
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const emoji = this.emojiToString(k);
      const count = Number(v ?? 0);
      if (!emoji || !Number.isFinite(count) || count <= 0) continue;

      out.push({
        emoji,
        count,
        reactedByMe: this.didUserReact(m, emoji),
      });
    }

    return out.sort((a, b) => b.count - a.count);
  }

  didUserReact(m: Message, emoji: string): boolean {
    if (!this.currentUserId) return false;
    const by = (m as any)?.reactionBy?.[emoji] as Record<string, boolean> | undefined;
    return !!by?.[this.currentUserId];
  }

  getReactedUserNames(m: Message, emoji: string): string[] {
    const by = ((m as any)?.reactionBy?.[emoji] ?? {}) as Record<string, boolean>;
    const ids = Object.keys(by).filter((uid) => by[uid]);
    return ids.map((uid) => this.users.find((u) => u.id === uid)?.name ?? uid);
  }

  // ---------------------------
  // Reactions (Firestore)
  // ---------------------------
  async toggleReaction(m: Message, emojiInput: any, ctx: 'root' | 'reply') {
    const uid = this.currentUserId;
    if (!uid) return;

    const emoji = this.emojiToString(emojiInput);
    if (!emoji) return;

    const ref =
      ctx === 'root'
        ? doc(this.fs, `channels/${this.channelId}/messages/${this.rootMessage.id}`)
        : doc(this.fs, `channels/${this.channelId}/messages/${this.rootMessage.id}/replies/${m.id}`);

    try {
      await runTransaction(this.fs, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;

        const data = snap.data() as any;
        const key = String(emoji);

        const already = !!data?.reactionBy?.[key]?.[uid];
        const currentCount = Number(data?.reactions?.[key] ?? 0);

        const displayName =
          (this.users.find(u => u.id === uid)?.name ?? '').trim() || 'Unbekannt';

        if (already) {
          const updatePayload: any = {
            [`reactionBy.${key}.${uid}`]: deleteField(),
          };

          if (currentCount <= 1) updatePayload[`reactions.${key}`] = deleteField();
          else updatePayload[`reactions.${key}`] = increment(-1);

          tx.update(ref, updatePayload);
          return;
        }

        tx.update(ref, {
          [`reactionBy.${key}.${uid}`]: true,
          [`reactions.${key}`]: increment(1),
        });
      });
    } catch (err) {
      console.error('[Thread] Reaction update failed:', err);
    }
  }

  hoveredReaction: { msgId: string; emoji: string } | null = null;

  onReactionHover(m: Message | null, emoji?: string) {
    if (!m || !emoji) {
      this.hoveredReaction = null;
      return;
    }
    this.hoveredReaction = { msgId: m.id, emoji };
  }

  isReactionHovered(m: Message, emoji: string): boolean {
    return !!this.hoveredReaction
      && this.hoveredReaction.msgId === m.id
      && this.hoveredReaction.emoji === emoji;
  }

  reactionNames(m: Message, emoji: string): string[] {
    const by = ((m as any)?.reactionBy?.[emoji] || {}) as Record<string, any>;

    const myUid = this.currentUserId ?? '';

    const names = Object.keys(by)
      .filter((uid) => !!by[uid])
      .map((uid) => {
        if (myUid && uid === myUid) return 'Du';
        return this.users.find((u) => u.id === uid)?.name ?? 'Unbekannt';
      });

    return names.length ? names : ['Unbekannt'];
  }

  reactionVerb(m: Message, emoji: string): string {
    const names = this.reactionNames(m, emoji);
    const includesYou = names.includes('Du');

    if (includesYou && names.length === 1) return 'hast reagiert';
    return names.length === 1 ? 'hat reagiert' : 'haben reagiert';
  }

  private emojiToString(x: any): string {
    if (typeof x === 'string') return x;

    const native = x?.native ?? x?.emoji?.native ?? x?.emoji?.colons;
    if (typeof native === 'string') return native;

    const s = String(x ?? '');
    return s === '[object Object]' ? '' : s;
  }

  userName(uid?: string | null): string {
    if (!uid) return 'Unbekannt';
    return this.users.find(u => u.id === uid)?.name ?? 'Unbekannt';
  }

  userAvatar(uid?: string | null): string {
    if (!uid) return '/public/images/avatars/avatar-default.svg';
    return this.users.find(u => u.id === uid)?.avatarUrl ?? '/public/images/avatars/avatar-default.svg';
  }

}
