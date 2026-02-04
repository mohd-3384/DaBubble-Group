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
    
    this.router.events.subscribe(() => {
      this.checkIfResetPasswordPage();
    });
    
    
    this.checkIfResetPasswordPage();
    setTimeout(() => this.checkIfResetPasswordPage(), 100);
    
    
    this.route.queryParams.subscribe((params) => {
      console.log('queryParams.subscribe triggered:', params);
      const hasOob = !!params['oobCode'];
      console.log('hasOob from queryParams:', hasOob);
      if (hasOob) {
        console.log('Setting showEnterPassword from queryParams');
        this.showEnterPassword.set(true);
        this.showLoginCard.set(false);
        this.showRegisterCard.set(false);
        this.showAvatar.set(false);
        this.showReset.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  ngAfterViewInit() {
    this.checkIfResetPasswordPage();
    this.cdr.markForCheck();
  }

  private checkIfResetPasswordPage() {
    const isEnterNewPasswordRoute = this.router.url === '/enter-new-password' || this.router.url.startsWith('/enter-new-password?');
    const hasOobCode = this.route.snapshot.queryParams['oobCode'];
    
    console.log('checkIfResetPasswordPage - URL:', this.router.url);
    console.log('checkIfResetPasswordPage - isEnterNewPasswordRoute:', isEnterNewPasswordRoute);
    console.log('checkIfResetPasswordPage - hasOobCode:', hasOobCode);
    
    if (isEnterNewPasswordRoute || hasOobCode) {
      console.log('Setting showEnterPassword to true');
      this.showEnterPassword.set(true);
      this.showLoginCard.set(false);
      this.showRegisterCard.set(false);
      this.showAvatar.set(false);
      this.showReset.set(false);
      this.cdr.markForCheck();
    }
  }

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
    this.showEnterPassword.set(false);
  }

  backToLogin() {
    this.showLoginCard.set(true);
    this.showRegisterCard.set(false);
    this.showAvatar.set(false);
    this.showReset.set(false);
    this.showEnterPassword.set(false);
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

  onPasswordResetSuccess() {
    setTimeout(() => {
      this.backToLogin(); 
    }, 3000);
  }

  onEnterPasswordSuccess() {
    setTimeout(() => {
      this.backToLogin();
    }, 3000);
  }
}

