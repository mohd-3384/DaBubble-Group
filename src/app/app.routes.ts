import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ShellComponent } from './shared/shell/shell/shell.component';
import { ChatComponent } from './chat/chat.component';
import { ThreadComponent } from './thread/thread.component';


export const routes: Routes = [
  { path: 'login', component: LoginComponent },

  {
    path: '',
    component: ShellComponent,   // 3-Spalten-Layout
    children: [
      { path: 'channel/:cid', component: ChatComponent },             // Mitte
      { path: 'dm/:uid', component: ChatComponent },             // Mitte (gleiche Komponente, anderer Modus)
      { path: 'thread/:mid', component: ThreadComponent, outlet: 'thread' }, // Rechts
      { path: '', pathMatch: 'full', redirectTo: 'channel/willkommen' }
    ],
  },

  { path: '**', redirectTo: '' },
];
