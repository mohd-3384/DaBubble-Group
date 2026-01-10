import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { Message } from '../services/thread.state';

type MentionUser = { id: string; name: string; avatarUrl?: string };

@Component({
  selector: 'app-thread',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerModule],
  templateUrl: './thread.component.html',
  styleUrl: './thread.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThreadComponent {
  @Input() header: { title: string; channel?: string } = { title: 'Thread' };
  @Input({ required: true }) rootMessage!: Message;
  @Input() replies: Message[] = [];

  @Input() users: MentionUser[] = [];

  @Output() send = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  draft = '';
  showEmoji = false;
  showUsers = false;

  messageEmojiForId: string | null = null;
  emojiPopoverPos = {
    top: 0,
    left: 0,
    placement: 'bottom' as 'top' | 'bottom',
  };

  private reactionsByMsg: Record<string, Record<string, number>> = {};

  trackReaction = (_: number, it: { emoji: string; count: number }) => it.emoji;

  reactionList(messageId: string): { emoji: string; count: number }[] {
    const map = this.reactionsByMsg[messageId];
    if (!map) return [];
    return Object.entries(map)
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count);
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

    const btn = ev.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();

    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const viewportW = window.innerWidth || document.documentElement.clientWidth;

    const pickerHeight = 360;
    const pickerWidth = 360;
    const offset = 8;

    const roomBelow = viewportH - rect.bottom;
    const placement: 'top' | 'bottom' =
      roomBelow > pickerHeight + offset ? 'bottom' : 'top';

    let top = placement === 'bottom'
      ? rect.bottom + offset
      : rect.top - pickerHeight - offset;

    let left = rect.left;
    const maxLeft = viewportW - pickerWidth - 16;
    if (left > maxLeft) left = Math.max(16, maxLeft);

    this.messageEmojiForId = messageId;
    this.emojiPopoverPos = { top, left, placement };
    this.showEmoji = false;
    this.showUsers = false;
  }


  trackReply = (_: number, r: Message) => r.id;
  trackUser = (_: number, u: MentionUser) => u.id;

  @HostListener('document:click')
  onDocumentClick() {
    this.showEmoji = false;
    this.showUsers = false;
    this.messageEmojiForId = null;
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
  }

  onEmojiSelect(e: any) {
    const native = e?.emoji?.native ?? e?.emoji?.char ?? e?.native ?? '';

    // If a message reaction picker is open => react to that message
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
}
