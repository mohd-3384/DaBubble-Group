import { Component, inject, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Router } from '@angular/router';
import { Observable, take } from 'rxjs';
import { UserService } from '../services/user.service';
import { ChannelService } from '../services/channel.service';
import { FormsModule } from '@angular/forms';
import { ChannelDoc, UserDoc } from '../interfaces/allInterfaces.interface';
import { Auth, authState } from '@angular/fire/auth';
import { ThreadState } from '../services/thread.state';
import { NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';

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
  private thread = inject(ThreadState);
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

  private auth = inject(Auth);

  constructor(
    private router: Router) {

    this.users$ = this.usersSvc.users$();
    this.channels$ = this.chanSvc.channels$();

    authState(this.auth).pipe(take(1)).subscribe(u => this.meId = u?.uid ?? null);

    this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => this.thread.close());
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
    const topic = (this.newChannelDescription || '').trim();

    try {
      await this.chanSvc.createChannel(id, topic);
      await this.chanSvc.addMeAsMember(id, 'owner');

      // Formular leeren & Modal schließen
      this.newChannelName = '';
      this.newChannelDescription = '';
      this.closeCreateChannelModal();

      // gleich in den neuen Channel springen
      this.router.navigate(['/channel', id]);
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
}
