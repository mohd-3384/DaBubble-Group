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

import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
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

      await this.router.navigate(['/channel', 'Entwicklerteam']);
    } catch (err: any) {
      console.error('Login fehlgeschlagen', err);
      this.authErrorCode = err?.code ?? 'unknown';
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

      await this.router.navigate(['/channel', 'Entwicklerteam']);
    } catch (err: any) {
      console.error('Guest-Login fehlgeschlagen', err);
      this.authErrorCode = err?.code ?? 'unknown';
    }
  }
}
