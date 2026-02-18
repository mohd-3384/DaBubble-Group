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
      await this.userSvc.ensureUserDoc({ role: 'member', status: 'active' });
      await this.router.navigate(['/channel', 'new']);
    } catch (err: any) {
      this.authErrorCode = err?.code ?? 'unknown';
    }
  }

  async loginWithGoogle() {
    this.authErrorCode = null;
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      await this.setupGoogleUser(result.user);
      await this.router.navigate(['/channel', 'new']);
    } catch (err: any) {
      this.handleGoogleError(err);
    }
  }

  private async setupGoogleUser(user: any) {
    await this.userSvc.ensureUserDoc({
      name: user.displayName || 'Google-Nutzer',
      email: user.email || '',
      role: 'member',
      status: 'active',
    });
  }

  private handleGoogleError(err: any) {
    const message = this.getGoogleErrorMessage(err.code);
    this.authErrorCode = err.code ?? 'unknown';
    alert(message);
  }

  private getGoogleErrorMessage(code: string): string {
    const messages: { [key: string]: string } = {
      'auth/popup-closed-by-user': 'Das Anmeldefenster wurde geschlossen.',
      'auth/popup-blocked': 'Popup wurde blockiert. Bitte Popups erlauben.',
      'auth/account-exists-with-different-credential': 'E-Mail mit anderer Methode registriert.',
      'auth/operation-not-allowed': 'Google-Anmeldung nicht aktiviert.',
    };
    return messages[code] || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
  }

  async loginAsGuest() {
    this.authErrorCode = null;
    try {
      await signInWithEmailAndPassword(this.auth, 'guest@dabubble.de', 'guest123');
      await this.userSvc.ensureUserDoc({ name: 'Guest', role: 'guest', status: 'active' });
      await this.router.navigate(['/channel', 'new']);
    } catch (err: any) {
      this.authErrorCode = err?.code ?? 'unknown';
    }
  }
}
