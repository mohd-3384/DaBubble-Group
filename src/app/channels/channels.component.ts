import { Component, inject, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { UserService } from '../services/user.service';
import { ChannelService } from '../services/channel.service';
import { ChannelDoc } from '../interfaces/channel.interface';
import { UserDoc } from '../interfaces/user.interface';



@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatTooltipModule,
    ScrollingModule,
  ],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
  // Wenn du den Service NUR hier scopen willst, ent-kommentieren:
  // providers: [ChannelService]
})
export class ChannelsComponent {
  private usersSvc = inject(UserService);
  private chanSvc = inject(ChannelService);

  users$!: Observable<UserDoc[]>;
  channels$!: Observable<ChannelDoc[]>;

  workspaceCollapsed = signal(false);
  @Output() workspaceCollapsedChange = new EventEmitter<boolean>();

  toggleWorkspace() {
    this.workspaceCollapsed.update((v) => {
      const next = !v;
      this.workspaceCollapsedChange.emit(next);   // <-- Shell informieren
      return next;
    });
  }

  /** UI State */
  collapsedChannels = signal(false);
  collapsedDMs = signal(false);
  meId: string | null = null; // später aus AuthService

  constructor(
    private router: Router) {

    // Wichtig: Erst hier (im DI-Kontext) Firebase-APIs aufrufen,
    // sonst kommt die Warnung „outside of an Injection context“.
    this.users$ = this.usersSvc.users$();
    this.channels$ = this.chanSvc.channels$();
  }

  /** trackBy-Helper für Performance */
  trackByUid = (_: number, u: UserDoc) => u.id;
  trackByCid = (_: number, c: ChannelDoc) => c.id;

  toggleChannels() { this.collapsedChannels.update(v => !v); }
  toggleDMs() { this.collapsedDMs.update(v => !v); }

  startNewMessage() {
    this.router.navigate(['/new']);
  }

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
