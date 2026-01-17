import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { RouterLink } from '@angular/router';

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
  showLoginCardComponent = true;
  showRegisterCardComponent = false;
  showChoseAvatarComponent = false;
  showPasswordResetComponent = false;

  openRegisterCard() {
    this.showLoginCardComponent = false;
    this.showRegisterCardComponent = true;
    this.showChoseAvatarComponent = false;
    this.showPasswordResetComponent = false;
  }

  openPasswordReset() {
    this.showLoginCardComponent = false;
    this.showPasswordResetComponent = true;
    this.showRegisterCardComponent = false;
    this.showChoseAvatarComponent = false;
  }

  backToLogin() {
    this.showLoginCardComponent = true;
    this.showRegisterCardComponent = false;
    this.showChoseAvatarComponent = false;
    this.showPasswordResetComponent = false;
  }

  // RegisterCard -> "Weiter" => Avatar Picker
  goToAvatarPicker() {
    this.showRegisterCardComponent = false;
    this.showChoseAvatarComponent = true;
  }

  // Avatar Picker -> Zurück
  backToRegister() {
    this.showChoseAvatarComponent = false;
    this.showRegisterCardComponent = true;
  }

  // Avatar gespeichert -> zurück zum Login
  onRegistrationSuccess() {
    this.backToLogin();
  }
}
