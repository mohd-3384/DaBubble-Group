import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { ChannelsComponent } from '../../channels/channels.component';
import { ThreadComponent } from '../../thread/thread.component';
import { ThreadState } from '../../services/thread.state';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    ChannelsComponent,
    ThreadComponent
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private thread = inject(ThreadState);
  vm = computed(() => this.thread.vm());

  workspaceCollapsed = false;

  onWorkspaceCollapsedChange(collapsed: boolean) {
    this.workspaceCollapsed = collapsed;
  }

  onSend(text: string) {
    this.thread.appendReply(text, { id: 'me', name: 'Ich' });
  }

  onClose() { this.thread.close(); }
}
