import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ChatComponent } from './chat/chat.component';
import { ShellComponent } from './shared/shell/shell.component';


export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: 'channel/:id', component: ChatComponent },
      { path: 'dm/:id', component: ChatComponent },
      { path: '', pathMatch: 'full', redirectTo: '' },
    ],
  },
  { path: '**', redirectTo: '' },
];
