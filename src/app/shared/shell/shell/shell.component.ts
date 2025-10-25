import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChannelsComponent } from '../../../channels/channels.component';
import { ThreadComponent } from '../../../thread/thread.component';
import { ThreadState } from '../../../services/thread.state';
import { HeaderComponent } from "../../header/header.component";

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, ChannelsComponent, ThreadComponent, HeaderComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private thread = inject(ThreadState);
  vm = computed(() => this.thread.vm());

  onSend(text: string) {
    // TODO: „Ich“-Benutzer – später aus AuthService holen
    this.thread.appendReply(text, { id: 'me', name: 'Ich' });
  }
  onClose() { this.thread.close(); }
}
