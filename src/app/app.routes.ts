import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ShellComponent } from './shared/shell/shell/shell.component';
import { ChatComponent } from './chat/chat.component';


export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: 'channel/:id', component: ChatComponent },
      { path: 'dm/:id', component: ChatComponent },
      { path: '', pathMatch: 'full', redirectTo: 'channel/willkommen' },
    ],
  },
  { path: '**', redirectTo: '' },
];
