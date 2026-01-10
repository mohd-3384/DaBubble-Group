import { Routes } from '@angular/router';
import { ShellComponent } from './shared/shell/shell.component';


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
  {
    path: '',
    component: ShellComponent,
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
        path: 'dm/:id',
        loadComponent: () =>
          import('./chat/chat.component').then((m) => m.ChatComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'channel/Frontend' },
    ],
  },
  { path: '**', redirectTo: 'channel/Frontend' },
];
