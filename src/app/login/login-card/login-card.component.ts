import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';

@Component({
  selector: 'app-login-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  templateUrl: './login-card.component.html',
  styleUrls: ['./login-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginCardComponent {
  private auth = inject(Auth);
  private router = inject(Router);

  email = '';
  password = '';

  authErrorCode: string | null = null;

  /** Normales Login mit E-Mail + Passwort */
  async login() {
    this.authErrorCode = null;
    try {
      await signInWithEmailAndPassword(this.auth, this.email, this.password);
      // nach erfolgreichem Login z.B. in den zuletzt genutzten Channel
      await this.router.navigate(['/channel', 'Entwicklerteam']);
    } catch (err: any) {
      console.error('Login fehlgeschlagen', err);
      this.authErrorCode = err?.code ?? 'unknown';
    }
  }

  /** Gäste-Login: immer mit demselben Guest-Account */
  async loginAsGuest() {
    this.authErrorCode = null;

    const GUEST_EMAIL = 'guest@dabubble.de';
    const GUEST_PASSWORD = 'guest123';

    try {
      await signInWithEmailAndPassword(this.auth, GUEST_EMAIL, GUEST_PASSWORD);
      await this.router.navigate(['/channel', 'Entwicklerteam']);
    } catch (err: any) {
      console.error('Guest-Login fehlgeschlagen', err);
      this.authErrorCode = err?.code ?? 'unknown';
    }
  }
}
