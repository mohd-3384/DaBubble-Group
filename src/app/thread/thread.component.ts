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


  /** alle User (für @) */
  @Input() users: MentionUser[] = [];

  @Output() send = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  draft = '';
  showEmoji = false;
  showUsers = false;

  trackReply = (_: number, r: Message) => r.id;
  trackUser = (_: number, u: MentionUser) => u.id;

  @HostListener('document:click')
  onDocumentClick() {
    this.showEmoji = false;
    this.showUsers = false;
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
  }

  onEmojiSelect(e: any) {
    const native = e?.emoji?.native ?? e?.emoji?.char ?? e?.native ?? '';
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
