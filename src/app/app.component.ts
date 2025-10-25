import { Component } from '@angular/core';
import { HeaderComponent } from './shared/header/header.component';
import { ChannelsComponent } from './channels/channels.component';
import { ChatComponent } from './chat/chat.component';
import { ThreadComponent } from './thread/thread.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [HeaderComponent, RouterLink, ChannelsComponent, ChatComponent, ThreadComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'dabubble';
}
