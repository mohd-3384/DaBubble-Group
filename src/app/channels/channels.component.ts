import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { UserService, UserDoc } from '../services/user.service';
import { ChannelService } from '../services/channel.service';
import { ChannelDoc } from '../interfaces/channel.interface';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink, RouterLinkActive,
    MatButtonModule, MatIconModule, MatListModule,
    MatTooltipModule,
    ScrollingModule,        // <-- wichtig für Tooltips (CdkScrollable)
  ],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
})
export class ChannelsComponent {
  private usersSvc = inject(UserService);
  private chanSvc = inject(ChannelService);

  users$: Observable<UserDoc[]> = this.usersSvc.users$();
  channels$: Observable<ChannelDoc[]> = this.chanSvc.channels$();

  collapsedChannels = signal(false);
  collapsedDMs = signal(false);

  meId: string | null = null;

  trackByUid = (_: number, u: UserDoc) => u.id;
  trackByCid = (_: number, c: ChannelDoc) => c.id;

  toggleChannels() { this.collapsedChannels.update(v => !v); }
  toggleDMs() { this.collapsedDMs.update(v => !v); }

  async addChannel() {
    const raw = prompt('Neuer Channel-Name (ohne #, z. B. "entwicklerteam")');
    if (!raw) return;
    const id = raw.trim().toLowerCase().replace(/\s+/g, '-');

    // TODO: aus Auth holen
    const me = { id: 'uid_marcus', name: 'Marcus Hartmann', avatar: '/public/images/avatars/avatar1.svg' };

    await this.chanSvc.createChannel(id, me.id);
    await this.chanSvc.addMember(id, me.id, 'owner');
    await this.chanSvc.postWelcome(id, me);
  }
}
