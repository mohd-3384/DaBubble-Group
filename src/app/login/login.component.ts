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
  showSplash = signal(this.shouldShowSplash());
  showLoginCard = signal(true);
  showRegisterCard = signal(false);
  showAvatar = signal(false);
  showReset = signal(false);
  showEnterPassword = signal(false);

  successMessage = signal(false);

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  /** Initializes the component, animations, router subscriptions, and query params. */
  ngOnInit() {
    if (this.showSplash()) this.scheduleSplashAnimation();
    this.setupRouterSubscription();
    this.checkIfResetPasswordPage();
    setTimeout(() => this.checkIfResetPasswordPage(), 100);
    this.setupQueryParamsSubscription();
  }

  /** Hides splash screen after 5 seconds animation delay. Shows animation on every page load. */
  private scheduleSplashAnimation() {
    this.waitForSplashImages().then(() => {
      const container = document.querySelector('.splash-logo-container') as HTMLElement;
      if (container) {
        container.style.opacity = '1';
        void container.offsetWidth;
        container.classList.add('splash-ready');
      }
      this.runFinalLogoAnimation();
      setTimeout(() => this.showSplash.set(false), 6500);
    });
  }

  /** Returns true if the splash should be shown (first visit or page reload). */
  private shouldShowSplash(): boolean {
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const isReload = navEntry?.type === 'reload';
    const isFirstVisit = !sessionStorage.getItem('splashShown');
    if (isReload || isFirstVisit) {
      sessionStorage.setItem('splashShown', '1');
      return true;
    }
    return false;
  }

  /** Resolves once both splash images are loaded (or immediately if already cached). */
  private waitForSplashImages(): Promise<void> {
    const imgs = Array.from(
      document.querySelectorAll('.splash-logo, .splash-logo-name')
    ) as HTMLImageElement[];
    const promises = imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            })
    );
    return Promise.all(promises).then(() => {});
  }

  /**
   * At the 75% mark of the splash (4875ms), measures exact header logo position
   * and uses WAAPI to precisely animate the splash container to that position.
   */
  private runFinalLogoAnimation() {
    const phase1End = 6500 * 0.75;
    const phase2Duration = 6500 - phase1End;
    setTimeout(() => this.moveSplashToHeader(phase2Duration), phase1End);
  }

  /** Queries splash elements and triggers the WAAPI move to header position. */
  private moveSplashToHeader(duration: number) {
    const container = document.querySelector('.splash-logo-container') as HTMLElement;
    const splashImg = document.querySelector('.splash-logo') as HTMLElement;
    const headerImg = document.querySelector('.logo .logo-img') as HTMLElement;
    if (!container || !splashImg || !headerImg) return;
    const { dx, dy, scale, endGap } = this.calcTargetTransform(headerImg, container, splashImg);
    this.resetContainerAnimation(container);
    this.animateContainerToHeader(container, dx, dy, scale, endGap, duration);
  }

  /** Calculates the dx, dy, scale and gap needed to land the splash logo on the header logo. */
  private calcTargetTransform(headerImg: HTMLElement, container: HTMLElement, splashImg: HTMLElement) {
    const hRect = headerImg.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const sRect = splashImg.getBoundingClientRect();
    const cCX = cRect.left + cRect.width / 2;
    const cCY = cRect.top + cRect.height / 2;
    const scale = hRect.width / sRect.width;
    const offsetX = (sRect.left + sRect.width / 2) - cCX;
    const offsetY = (sRect.top + sRect.height / 2) - cCY;
    return {
      dx: (hRect.left + hRect.width / 2) - cCX - offsetX * scale,
      dy: (hRect.top + hRect.height / 2) - cCY - offsetY * scale,
      scale,
      endGap: `${(6 / scale).toFixed(1)}px`,
    };
  }

  /** Cancels the CSS animation on the container and resets its transform. */
  private resetContainerAnimation(container: HTMLElement) {
    container.style.animation = 'none';
    container.style.transform = 'translate(0, 0) scale(1)';
    container.style.gap = '20px';
    void container.offsetWidth;
  }

  /** Runs the WAAPI animation moving the splash container to the header logo position. */
  private animateContainerToHeader(
    container: HTMLElement, dx: number, dy: number, scale: number, endGap: string, duration: number
  ) {
    container.animate(
      [
        { transform: 'translate(0, 0) scale(1)', gap: '20px' },
        { transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${scale.toFixed(4)})`, gap: endGap },
      ],
      { duration, easing: 'ease-in-out', fill: 'forwards' }
    );
  }

  /** Subscribes to router events and checks if current route is password reset page. */
  private setupRouterSubscription() {
    this.router.events.subscribe(() => {
      this.checkIfResetPasswordPage();
    });
  }

  /** Subscribes to query params and shows password reset form if oobCode is present. */
  private setupQueryParamsSubscription() {
    this.route.queryParams.subscribe((params) => {
      if (params['oobCode']) {
        this.showEnterPasswordRoute();
      }
    });
  }

  /** Displays the enter-new-password card and marks component for change detection. */
  private showEnterPasswordRoute() {
    this.showEnterPassword.set(true);
    this.resetAllCardsExcept('enterPassword');
    this.cdr.markForCheck();
  }

  /** Angular lifecycle hook that checks if reset password page and triggers change detection. */
  ngAfterViewInit() {
    this.checkIfResetPasswordPage();
    this.cdr.markForCheck();
  }

  /** Checks if the current route is password reset page or has oobCode query parameter. */
  private checkIfResetPasswordPage() {
    const isEnterNewPasswordRoute = this.isEnterPasswordRoute();
    const hasOobCode = this.route.snapshot.queryParams['oobCode'];
    
    if (isEnterNewPasswordRoute || hasOobCode) {
      this.showEnterPasswordRoute();
    }
  }

  /** Returns true if the current URL is enter-new-password route. */
  private isEnterPasswordRoute(): boolean {
    const url = this.router.url;
    return url === '/enter-new-password' || url.startsWith('/enter-new-password?');
  }

  /** Displays the registration card and hides all other cards. */
  openRegisterCard() {
    this.resetAllCardsExcept('register');
  }

  /** Displays the password reset card and hides all other cards. */
  openPasswordReset() {
    this.resetAllCardsExcept('reset');
  }

  /** Resets all cards and displays the specified card type (register, reset, or enterPassword). */
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

  /** Hides all login cards (login, register, avatar, reset, enterPassword). */
  private resetAllCards() {
    this.showLoginCard.set(false);
    this.showRegisterCard.set(false);
    this.showAvatar.set(false);
    this.showReset.set(false);
    this.showEnterPassword.set(false);
  }

  /** Resets all cards and displays the login card. */
  backToLogin() {
    this.resetAllCards();
    this.showLoginCard.set(true);
  }

  /** Navigates from registration to avatar selection screen. */
  goToAvatarPicker() {
    this.showRegisterCard.set(false);
    this.showAvatar.set(true);
  }

  /** Returns from avatar selection back to the registration card. */
  backToRegister() {
    this.showAvatar.set(false);
    this.showRegisterCard.set(true);
  }

  /** Displays success message and navigates back to login after registration completion. */
  onRegistrationSuccess() {
    this.showSuccessMessage();
    this.scheduleNavigation(3000);
  }

  /** Navigates back to login after password reset email is sent. */
  onPasswordResetSuccess() {
    this.scheduleNavigation(3000);
  }

  /** Navigates back to login after new password is confirmed successfully. */
  onEnterPasswordSuccess() {
    this.scheduleNavigation(3000);
  }

  /** Displays the success message to the user. */
  private showSuccessMessage() {
    this.successMessage.set(true);
  }

  /** Hides success message and navigates back to login after specified delay in milliseconds. */
  private scheduleNavigation(delayMs: number) {
    setTimeout(() => {
      this.successMessage.set(false);
      this.backToLogin();
    }, delayMs);
  }
}

