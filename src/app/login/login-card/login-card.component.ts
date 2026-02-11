import { ChangeDetectionStrategy, Component, inject, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { Auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { UserService } from '../../services/user.service';

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
  @Output() forgotPassword = new EventEmitter<void>();

  private userSvc = inject(UserService);
  private auth = inject(Auth);
  private router = inject(Router);

  email = '';
  password = '';
  authErrorCode: string | null = null;

  onForgotPasswordClick() {
    this.forgotPassword.emit();
  }

  async login() {
    this.authErrorCode = null;
    try {
      await signInWithEmailAndPassword(this.auth, this.email, this.password);

      await this.userSvc.ensureUserDoc({
        role: 'member',
        status: 'active',
      });

      await this.router.navigate(['/channel', 'new']);
    } catch (err: any) {
      console.error('Login fehlgeschlagen', err);
      this.authErrorCode = err?.code ?? 'unknown';
    }
  }

  async loginWithGoogle() {
    this.authErrorCode = null;

    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(this.auth, provider);
      const user = result.user;

      // User-Dokument sicherstellen / aktualisieren
      await this.userSvc.ensureUserDoc({
        name: user.displayName || 'Google-Nutzer',
        email: user.email || '',
        role: 'member',
        status: 'active',
      });

      console.log('Google-Login erfolgreich:', user.uid);

      // Weiterleitung
      await this.router.navigate(['/channel', 'new']);

    } catch (err: any) {
      console.error('Google-Login fehlgeschlagen:', err);

      let message = 'Google-Anmeldung fehlgeschlagen';

      switch (err.code) {
        case 'auth/popup-closed-by-user':
          message = 'Das Anmeldefenster wurde geschlossen.';
          break;
        case 'auth/popup-blocked':
          message = 'Popup wurde vom Browser blockiert. Bitte Popups für diese Seite erlauben.';
          break;
        case 'auth/account-exists-with-different-credential':
          message = 'Diese E-Mail ist bereits mit einer anderen Methode registriert.';
          break;
        case 'auth/operation-not-allowed':
          message = 'Google-Anmeldung ist im Firebase-Projekt nicht aktiviert.';
          break;
        default:
          message = err.message || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
      }

      this.authErrorCode = err.code ?? 'unknown';
      alert(message); // später → Snackbar / Toast ersetzen
    }
  }

  /** Gäste-Login: IMMER derselbe Account => IMMER dieselbe UID => nur 1 users/{uid} möglich */
  async loginAsGuest() {
    this.authErrorCode = null;

    const GUEST_EMAIL = 'guest@dabubble.de';
    const GUEST_PASSWORD = 'guest123';

    try {
      await signInWithEmailAndPassword(this.auth, GUEST_EMAIL, GUEST_PASSWORD);

      await this.userSvc.ensureUserDoc({
        name: 'Guest',
        role: 'guest',
        status: 'active',
      });

      await this.router.navigate(['/channel', 'new']);
    } catch (err: any) {
      console.error('Guest-Login fehlgeschlagen', err);
      this.authErrorCode = err?.code ?? 'unknown';
    }
  }
}
