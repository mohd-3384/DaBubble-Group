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
      import('./imprint/imprint.component').then((m) => m.ImprintComponent),
  },
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./privacypolicy/privacypolicy.component').then(
        (m) => m.PrivacypolicyComponent
      ),
  },

  // Alles im Shell-Bereich ist geschützt
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'new',
        loadComponent: () =>
          import('./chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'channel/:id',
        loadComponent: () =>
          import('./chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'channel/:id/thread/:threadId',
        loadComponent: () =>
          import('./chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'dm/:id',
        loadComponent: () =>
          import('./chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'dm/:id/thread/:threadId',
        loadComponent: () =>
          import('./chat/chat.component').then((m) => m.ChatComponent),
      },

      // Channels-Liste Route (zeigt nur Sidebar in Mobile, Chat-Bereich leer in Desktop)
      {
        path: 'channels',
        loadComponent: () =>
          import('./chat/chat.component').then((m) => m.ChatComponent),
      },

      // Default im eingeloggten Bereich
      { path: '', pathMatch: 'full', redirectTo: 'new' },
    ],
  },

  // App-Start ohne Match -> Login
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  // Wildcard -> Login
  { path: '**', redirectTo: 'login' },
];
