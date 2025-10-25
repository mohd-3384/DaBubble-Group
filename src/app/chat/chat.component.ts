import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

// Angular Material (nur was wir brauchen)
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ThreadState, Message } from '../services/thread.state';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    MatIconModule, MatButtonModule, MatChipsModule, MatDividerModule, MatTooltipModule
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {
  private route = inject(ActivatedRoute);
  private thread = inject(ThreadState);

  // Demo: wir lesen, ob wir in einem Channel oder in einer DM sind
  // (nur für die Kopfzeile hier genutzt)
  kind: 'channel' | 'dm' = 'channel';
  name = '';

  constructor() {
    const url = location.pathname;
    this.kind = url.includes('/dm/') ? 'dm' : 'channel';
    this.name = this.route.snapshot.params['id'] ?? (this.kind === 'dm' ? 'Direct' : 'channel');
  }

  // Dummy-Nachrichten – ersetze später durch echte Daten
  messages: Message[] = [
    {
      id: 'm1',
      author: { id: 'u1', name: 'Noah Braun', avatarUrl: '/public/images/avatars/avatar1.svg' },
      text: 'Welche Version ist aktuell von Angular?',
      createdAt: new Date(),
      reactions: [{ emoji: '👍', count: 1 }]
    },
    {
      id: 'm2',
      author: { id: 'u2', name: 'Sofia Müller', avatarUrl: '/public/images/avatars/avatar1.svg' },
      text: 'Ich habe die gleiche Frage…',
      createdAt: new Date(),
      reactions: [{ emoji: '🔥', count: 1 }]
    },
    {
      id: 'm3',
      author: { id: 'u3', name: 'Frederik Beck', avatarUrl: '/public/images/avatars/avatar1.svg' },
      text: 'Ja das ist es.',
      createdAt: new Date(),
      reactions: [{ emoji: '👍', count: 1 }]
    }
  ];

  openThreadFromMessage(m: Message) {
    this.thread.openThread({
      header: {
        title: 'Thread',
        channel: this.kind === 'channel' ? `# ${this.name}` : undefined
      },
      root: m,
      replies: [
        {
          id: 'r1',
          author: { id: 'u2', name: 'Sofia Müller', avatarUrl: '/public/images/avatars/avatar1.svg' },
          text: 'Ich habe die gleiche Frage…',
          createdAt: new Date()
        }
      ]
    });
  }
}
