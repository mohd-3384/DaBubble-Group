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
import { FormsModule } from '@angular/forms';

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
    FormsModule
  ],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
})
export class ChannelsComponent {
  private usersSvc = inject(UserService);
  private chanSvc = inject(ChannelService);

  users$!: Observable<UserDoc[]>;
  channels$!: Observable<ChannelDoc[]>;

  workspaceCollapsed = signal(false);
  @Output() workspaceCollapsedChange = new EventEmitter<boolean>();

  /** UI State */
  collapsedChannels = signal(false);
  collapsedDMs = signal(false);
  meId: string | null = null;

  /** Channel-Modal */
  createChannelOpen = false;
  newChannelName = '';
  newChannelDescription = '';

  toggleWorkspace() {
    this.workspaceCollapsed.update((v) => {
      const next = !v;
      this.workspaceCollapsedChange.emit(next);
      return next;
    });
  }

  constructor(
    private router: Router) {

    this.users$ = this.usersSvc.users$();
    this.channels$ = this.chanSvc.channels$();
  }

  /** Modal öffnen */
  openCreateChannelModal() {
    this.createChannelOpen = true;
    this.newChannelName = '';
    this.newChannelDescription = '';
  }

  /** Modal schließen */
  closeCreateChannelModal() {
    this.createChannelOpen = false;
  }

  /** Channel wirklich erstellen (Submit im Formular) */
  async submitCreateChannel() {
    const raw = (this.newChannelName || '').trim();
    if (!raw) return;

    const id = raw.toLowerCase().replace(/\s+/g, '-');

    try {
      await this.chanSvc.createChannel(id);
      await this.chanSvc.addMeAsMember(id, 'owner');
      // await this.chanSvc.postWelcome(id);

      // Formular leeren & Modal schließen
      this.newChannelName = '';
      this.newChannelDescription = '';
      this.closeCreateChannelModal();

      // optional: gleich in den neuen Channel springen
      // this.router.navigate(['/channel', id]);
    } catch (e) {
      console.error('[ChannelModal] create failed:', e);
    }
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
    const me = { id: 'uid_guest', name: 'Guest', avatar: '/public/images/avatars/avatar-default.svg' };

    await this.chanSvc.createChannel(id);
    await this.chanSvc.addMeAsMember(id, 'owner');
    await this.chanSvc.postWelcome(id);
  }
}
