import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ChannelsComponent } from './channels/channels.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'channels', component: ChannelsComponent },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
