import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { Message } from '../interfaces/allInterfaces.interface';

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
  constructor(private host: ElementRef<HTMLElement>) { }

  @Input() header: { title: string; channel?: string } = { title: 'Thread' };
  @Input({ required: true }) rootMessage!: Message;
  @Input() replies: Message[] = [];
  @Input() users: MentionUser[] = [];

  @Output() send = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<{ messageId: string; text: string }>();

  editingMessageId: string | null = null;
  editDraft = '';

  editMenuForId: string | null = null;
  editMenuPos = { top: 0, left: 0 };

  draft = '';
  showEmoji = false;
  showUsers = false;

  messageEmojiForId: string | null = null;
  emojiPopoverPos = { top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' };
  hoveredRowId: string | null = null;

  private reactionsByMsg: Record<string, Record<string, number>> = {};
  private popoverHoverForId: string | null = null;
  private leaveTimer: any = null;

  trackReaction = (_: number, it: { emoji: string; count: number }) => it.emoji;
  trackReply = (_: number, r: Message) => r.id;
  trackUser = (_: number, u: MentionUser) => u.id;

  reactionList(messageId: string) {
    const map = this.reactionsByMsg[messageId];
    if (!map) return [];
    return Object.entries(map).map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count);
  }

  private addReactionToMessage(messageId: string, emoji: string) {
    if (!emoji) return;
    const store = (this.reactionsByMsg[messageId] ||= {});
    store[emoji] = (store[emoji] || 0) + 1;
  }

  toggleMessageEmojiPicker(ev: MouseEvent, messageId: string) {
    ev.stopPropagation();

    if (this.messageEmojiForId === messageId) {
      this.messageEmojiForId = null;
      return;
    }

    // wenn Emoji aufgeht, More-Menü zu
    this.editMenuForId = null;

    const btn = ev.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();

    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const viewportW = window.innerWidth || document.documentElement.clientWidth;

    const pickerHeight = 360;
    const pickerWidth = 360;
    const offset = 8;

    const roomBelow = viewportH - rect.bottom;
    const placement: 'top' | 'bottom' = roomBelow > pickerHeight + offset ? 'bottom' : 'top';

    const top = placement === 'bottom'
      ? rect.bottom + offset
      : rect.top - pickerHeight - offset;

    let left = rect.left;
    const maxLeft = viewportW - pickerWidth - 16;
    if (left > maxLeft) left = Math.max(16, maxLeft);

    this.messageEmojiForId = messageId;
    this.emojiPopoverPos = { top, left, placement };

    this.showEmoji = false;
    this.showUsers = false;

    // Row aktiv halten, damit man rüberfahren kann
    this.hoveredRowId = messageId;
  }


  // nur schließen wenn Klick außerhalb des Thread-Components
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    const target = ev.target as Node | null;
    if (!target) return;

    if (this.host.nativeElement.contains(target)) return;

    this.closePopovers();
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

  closePopovers() {
    this.showEmoji = false;
    this.showUsers = false;
    this.messageEmojiForId = null;
    this.editMenuForId = null;

    this.popoverHoverForId = null;
    this.hoveredRowId = null;

    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
  }

  onEmojiSelect(e: any) {
    const native = e?.emoji?.native ?? e?.emoji?.char ?? e?.native ?? '';

    if (this.messageEmojiForId) {
      this.addReactionToMessage(this.messageEmojiForId, native);
      this.messageEmojiForId = null;
      return;
    }

    this.draft += native;
    this.showEmoji = false;
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

    console.log('[Thread] send.emit()', text);
    this.send.emit(text);

    this.draft = '';
    this.closePopovers();
  }

  @Input() currentUserId: string | null = null;

  isOwnMessage(m: { author?: { id?: string } } | null | undefined): boolean {
    return !!this.currentUserId && String(m?.author?.id ?? '') === this.currentUserId;
  }

  startEdit(m: any) {
    if (!this.isOwnMessage(m)) return;

    this.editMenuForId = null;
    this.messageEmojiForId = null;
    this.showEmoji = false;
    this.showUsers = false;

    this.editingMessageId = m.id;
    this.editDraft = (m.text ?? '').toString();
  }

  cancelEdit(m?: Message) {
    const id = m?.id ?? this.editingMessageId ?? null;

    // Edit state reset
    this.editingMessageId = null;
    this.editDraft = '';

    if (!id) return;

    // ✅ Timer killen (sonst bleibt is-active manchmal hängen)
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;

    // ✅ alles, was isRowActive() triggert, zurücksetzen
    if (this.hoveredRowId === id) this.hoveredRowId = null;
    if (this.popoverHoverForId === id) this.popoverHoverForId = null;

    if (this.editMenuForId === id) this.editMenuForId = null;
    if (this.messageEmojiForId === id) this.messageEmojiForId = null;
  }

  private resetRowUiState(messageId: string) {
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;

    if (this.hoveredRowId === messageId) this.hoveredRowId = null;
    if (this.popoverHoverForId === messageId) this.popoverHoverForId = null;

    if (this.editMenuForId === messageId) this.editMenuForId = null;
    if (this.messageEmojiForId === messageId) this.messageEmojiForId = null;
  }

  saveEdit(m: Message) {
    if (!this.isOwnMessage(m)) return;

    const next = (this.editDraft || '').trim();
    if (!next || next === (m.text ?? '').toString()) {
      this.cancelEdit(m);
      this.resetRowUiState(m.id);
      return;
    }

    this.edit.emit({ messageId: m.id, text: next });

    this.cancelEdit(m);
    this.resetRowUiState(m.id);
  }

  toggleEditMenu(ev: MouseEvent, m: Message) {
    ev.stopPropagation();
    if (!this.isOwnMessage(m)) return;
    if (this.editingMessageId === m.id) return;

    const willOpen = this.editMenuForId !== m.id;
    this.editMenuForId = willOpen ? m.id : null;

    // ✅ Wenn More-Menü aufgeht, Emoji zu
    if (willOpen) this.messageEmojiForId = null;

    // ✅ Row aktiv halten, damit man zum Popover kommt
    if (willOpen) this.hoveredRowId = m.id;

    this.showEmoji = false;
    this.showUsers = false;
  }

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

  isRowHovered(id: string) {
    return this.hoveredRowId === id;
  }

  isRowActive(id: string) {
    const popoverOpen = this.editMenuForId === id || this.messageEmojiForId === id;
    const hoverRow = this.hoveredRowId === id;
    const hoverPopover = this.popoverHoverForId === id;
    return hoverRow || hoverPopover || popoverOpen;
  }
}
