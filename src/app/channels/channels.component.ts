import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

type Channel = { id: string; name: string; unread?: number; members?: number };
type DM = { id: string; name: string; avatar?: string; online?: boolean; unread?: number };

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive,
    MatButtonModule, MatIconModule, MatListModule,
    MatDividerModule, MatBadgeModule, MatTooltipModule
  ],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
})
export class ChannelsComponent {
  channels = signal<Channel[]>([
    { id: 'willkommen', name: 'Willkommen', unread: 0, members: 9 },
    { id: 'entwicklerteam', name: 'Entwicklerteam', unread: 2, members: 12 },
    { id: 'random', name: 'Random', unread: 0, members: 5 },
  ]);

  dms = signal<DM[]>([
    { id: 'me', name: 'Guest (Du)', avatar: '/public/images/avatars/avatar1.svg', online: true },
    { id: 'marcus', name: 'Marcus Hartmann', avatar: '/public/images/avatars/avatar1.svg', online: true, unread: 1 },
    { id: 'sofia', name: 'Sofia Müller', avatar: '/public/images/avatars/avatar1.svg', online: false },
    { id: 'noah', name: 'Noah Braun', avatar: '/public/images/avatars/avatar1.svg', online: false },
  ]);

  collapsedChannels = signal(false);
  collapsedDMs = signal(false);

  toggleChannels() { this.collapsedChannels.update(v => !v); }
  toggleDMs() { this.collapsedDMs.update(v => !v); }
  addChannel() { /* TODO: Dialog / Route */ }
}
