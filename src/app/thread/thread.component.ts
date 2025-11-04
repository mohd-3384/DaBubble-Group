import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';

import { Message } from '../services/thread.state';

@Component({
  selector: 'app-thread',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule
  ],
  templateUrl: './thread.component.html',
  styleUrl: './thread.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThreadComponent {
  /** Header (Titel + optionaler Kanalname) */
  @Input() header: { title: string; channel?: string } = { title: 'Thread' };

  /** Ursprungsnachricht der Unterhaltung */
  @Input({ required: true }) rootMessage!: Message;

  /** Antworten im Thread */
  @Input() replies: Message[] = [];

  /** Events */
  @Output() send = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  /** Composer */
  draft = '';

  onSendClick() {
    const text = this.draft.trim();
    if (!text) return;
    this.send.emit(text);
    this.draft = '';
  }
}
