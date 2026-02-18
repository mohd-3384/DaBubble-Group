import { ChangeDetectionStrategy, Component, inject, signal, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';

import { LoginCardComponent } from './login-card/login-card.component';
import { RegisterCardComponent } from './register-card/register-card.component';
import { ChoseAvatarComponent } from './chose-avatar/chose-avatar.component';
import { PasswordResetComponent } from './password-reset/password-reset.component';
import { EnterNewPasswordComponent } from './enter-new-password/enter-new-password.component';

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
    EnterNewPasswordComponent,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, AfterViewInit {
  showSplash = signal(true);
  showLoginCard = signal(true);
  showRegisterCard = signal(false);
  showAvatar = signal(false);
  showReset = signal(false);
  showEnterPassword = signal(false);

  successMessage = signal(false);

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.scheduleSplashAnimation();
    this.setupRouterSubscription();
    this.checkIfResetPasswordPage();
    setTimeout(() => this.checkIfResetPasswordPage(), 100);
    this.setupQueryParamsSubscription();
  }

  private scheduleSplashAnimation() {
    setTimeout(() => {
      this.showSplash.set(false);
    }, 5000);
  }

  private setupRouterSubscription() {
    this.router.events.subscribe(() => {
      this.checkIfResetPasswordPage();
    });
  }

  private setupQueryParamsSubscription() {
    this.route.queryParams.subscribe((params) => {
      if (params['oobCode']) {
        this.showEnterPasswordRoute();
      }
    });
  }

  private showEnterPasswordRoute() {
    this.showEnterPassword.set(true);
    this.resetAllCardsExcept('enterPassword');
    this.cdr.markForCheck();
  }

  ngAfterViewInit() {
    this.checkIfResetPasswordPage();
    this.cdr.markForCheck();
  }

  private checkIfResetPasswordPage() {
    const isEnterNewPasswordRoute = this.isEnterPasswordRoute();
    const hasOobCode = this.route.snapshot.queryParams['oobCode'];
    
    if (isEnterNewPasswordRoute || hasOobCode) {
      this.showEnterPasswordRoute();
    }
  }

  private isEnterPasswordRoute(): boolean {
    const url = this.router.url;
    return url === '/enter-new-password' || url.startsWith('/enter-new-password?');
  }

  openRegisterCard() {
    this.resetAllCardsExcept('register');
  }

  openPasswordReset() {
    this.resetAllCardsExcept('reset');
  }

  private resetAllCardsExcept(type: 'register' | 'reset' | 'enterPassword') {
    this.resetAllCards();
    switch (type) {
      case 'register':
        this.showRegisterCard.set(true);
        break;
      case 'reset':
        this.showReset.set(true);
        break;
      case 'enterPassword':
        this.showEnterPassword.set(true);
        break;
    }
  }

  private resetAllCards() {
    this.showLoginCard.set(false);
    this.showRegisterCard.set(false);
    this.showAvatar.set(false);
    this.showReset.set(false);
    this.showEnterPassword.set(false);
  }

  backToLogin() {
    this.resetAllCards();
    this.showLoginCard.set(true);
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

  onRegistrationSuccess() {
    this.showSuccessMessage();
    this.scheduleNavigation(3000);
  }

  onPasswordResetSuccess() {
    this.scheduleNavigation(3000);
  }

  onEnterPasswordSuccess() {
    this.scheduleNavigation(3000);
  }

  private showSuccessMessage() {
    this.successMessage.set(true);
  }

  private scheduleNavigation(delayMs: number) {
    setTimeout(() => {
      this.successMessage.set(false);
      this.backToLogin();
    }, delayMs);
  }
}

