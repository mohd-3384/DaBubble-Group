import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Output, EventEmitter } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);

  email = '';
  password = '';
  authErrorCode: string | null = null;
  googleErrorMessage = '';
  loginErrorMessage = '';

  /** Emits the forgotPassword event to display password reset form. */
  onForgotPasswordClick() {
    this.forgotPassword.emit();
  }

  /** Authenticates user with email and password, then navigates to channel. */
  async login() {
    this.authErrorCode = null;
    this.googleErrorMessage = '';
    this.loginErrorMessage = '';
    try {
      await signInWithEmailAndPassword(this.auth, this.email, this.password);
      await this.userSvc.ensureUserDoc({ role: 'member', status: 'active' });
      await this.router.navigate(['/channel', 'new']);
    } catch (err: any) {
      this.authErrorCode = err?.code ?? 'unknown';
      this.loginErrorMessage = this.getLoginErrorMessage(err?.code);
      this.cdr.markForCheck();
    }
  }

  /** Authenticates user with Google provider and creates user document if needed. */
  async loginWithGoogle() {
    this.authErrorCode = null;
    this.googleErrorMessage = '';
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      await this.setupGoogleUser(result.user);
      await this.router.navigate(['/channel', 'new']);
    } catch (err: any) {
      this.handleGoogleError(err);
    }
  }

  /** Creates or updates user document in Firestore with Google auth profile data. */
  private async setupGoogleUser(user: any) {
    await this.userSvc.ensureUserDoc({
      name: user.displayName || 'Google-Nutzer',
      email: user.email || '',
      role: 'member',
      status: 'active',
    });
  }

  /** Handles Google authentication errors by displaying user-friendly error message. */
  private handleGoogleError(err: any) {
    const message = this.getGoogleErrorMessage(err.code);
    this.authErrorCode = err.code ?? 'unknown';
    this.googleErrorMessage = message;
    this.cdr.markForCheck();
  }

  /** Returns a user-friendly error message for Google authentication error codes. */
  private getGoogleErrorMessage(code: string): string {
    const messages: { [key: string]: string } = {
      'auth/popup-closed-by-user': 'Das Anmeldefenster wurde geschlossen.',
      'auth/popup-blocked': 'Popup wurde blockiert. Bitte Popups erlauben.',
      'auth/account-exists-with-different-credential': 'E-Mail mit anderer Methode registriert.',
      'auth/operation-not-allowed': 'Google-Anmeldung nicht aktiviert.',
    };
    return messages[code] || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
  }

  /** Authenticates as guest user and navigates to channel without registration. */
  async loginAsGuest() {
    this.authErrorCode = null;
    this.googleErrorMessage = '';
    this.loginErrorMessage = '';
    try {
      await signInWithEmailAndPassword(this.auth, 'guest@dabubble.de', 'guest123');
      await this.userSvc.ensureUserDoc({ name: 'Guest', role: 'guest', status: 'active' });
      await this.router.navigate(['/channel', 'new']);
    } catch (err: any) {
      this.authErrorCode = err?.code ?? 'unknown';
    }
  }

  /** Returns a user-friendly error message for login error codes. */
  private getLoginErrorMessage(code: string): string {
    const messages: { [key: string]: string } = {
      'auth/invalid-email': 'Ungültige E-Mail-Adresse.',
      'auth/user-disabled': 'Dieses Konto wurde deaktiviert.',
      'auth/user-not-found': 'Diese E-Mail-Adresse ist nicht registriert.',
      'auth/wrong-password': 'Ungültiges Passwort.',
      'auth/invalid-credential': 'Die E-Mail-Adresse oder das Passwort ist falsch.',
      'auth/too-many-requests': 'Zu viele fehlgeschlagene Versuche. Bitte später erneut versuchen.',
    };
    return messages[code] || 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.';
  }
}
