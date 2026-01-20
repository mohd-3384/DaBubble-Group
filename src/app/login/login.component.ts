import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { RouterLink, Router } from '@angular/router';

import { LoginCardComponent } from './login-card/login-card.component';
import { RegisterCardComponent } from './register-card/register-card.component';
import { ChoseAvatarComponent } from './chose-avatar/chose-avatar.component';
import { PasswordResetComponent } from './password-reset/password-reset.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,

    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    RouterLink,

    LoginCardComponent,
    RegisterCardComponent,
    ChoseAvatarComponent,
    PasswordResetComponent,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  showLoginCard = signal(true);
  showRegisterCard = signal(false);
  showAvatar = signal(false);
  showReset = signal(false);

  successMessage = signal(false);

  private router = inject(Router);

  openRegisterCard() {
    this.showLoginCard.set(false);
    this.showRegisterCard.set(true);
    this.showAvatar.set(false);
    this.showReset.set(false);
  }


  openPasswordReset() {
    this.showLoginCard.set(false);
    this.showReset.set(true);
    this.showRegisterCard.set(false);
    this.showAvatar.set(false);
  }

  backToLogin() {
    this.showLoginCard.set(true);
    this.showRegisterCard.set(false);
    this.showAvatar.set(false);
    this.showReset.set(false);
  }

  // RegisterCard -> "Weiter" => Avatar Picker
  goToAvatarPicker() {
    this.showRegisterCard.set(false);
    this.showAvatar.set(true);
  }

  // Avatar Picker -> Zurück
  backToRegister() {
    this.showAvatar.set(false);
    this.showRegisterCard.set(true);
  }

  // Avatar gespeichert -> zurück zum Login
  onRegistrationSuccess() {
    console.log('onRegistrationSuccess aufgerufen');

    this.successMessage.set(true);

    setTimeout(() => {
      console.log('Timeout – zurück zum Login');
      this.successMessage.set(false);
      this.backToLogin();
    }, 3000);
  }
}

