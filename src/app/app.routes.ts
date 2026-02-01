import { Routes } from '@angular/router';
import { ShellComponent } from './shared/shell/shell.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'imprint',
    loadComponent: () =>
      import('./pages/imprint/imprint.component').then((m) => m.ImprintComponent),
  },
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./pages/privacy-policy/privacy-policy.component').then(
        (m) => m.PrivacyPolicyComponent
      ),
  },

  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'new',
        loadComponent: () =>
          import('./components/chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'channel/:id',
        loadComponent: () =>
          import('./components/chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'channel/:id/thread/:threadId',
        loadComponent: () =>
          import('./components/chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'dm/:id',
        loadComponent: () =>
          import('./components/chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'dm/:id/thread/:threadId',
        loadComponent: () =>
          import('./components/chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'channels',
        loadComponent: () =>
          import('./components/chat/chat.component').then((m) => m.ChatComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'new' },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
