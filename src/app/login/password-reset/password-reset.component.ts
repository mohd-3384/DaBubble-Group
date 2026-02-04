import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';

@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss',
})
export class PasswordResetComponent {
  @Output() success = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private auth = inject(Auth);

  resetForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  successVisible = false;
  errorMessage = '';

  async onSubmit() {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const email = this.getEmailValue();
    await this.sendReset(email);
  }

  private getEmailValue(): string {
    return String(this.resetForm.value.email || '').trim();
  }

  private async sendReset(email: string) {
    try {
      await this.sendPasswordResetEmail(email);
      this.handleResetSuccess();
    } catch (err: any) {
      this.handleResetError(err);
    }
  }

  private async sendPasswordResetEmail(email: string) {
    const actionCodeSettings = {
      url: `${window.location.origin}/enter-new-password`,
      handleCodeInApp: true,
    };
    await sendPasswordResetEmail(this.auth, email, actionCodeSettings);
  }

  private handleResetSuccess() {
    this.errorMessage = '';
    this.successVisible = true;
    this.success.emit();
    this.scheduleHideMessage(5000);
    this.resetForm.reset();
  }

  private handleResetError(err: any) {
    console.error('[PasswordReset] Fehler:', err);
    this.errorMessage = this.getErrorMessage(err?.code);
    this.successVisible = true;
    this.scheduleHideMessage(5000);
  }

  private getErrorMessage(code: string): string {
    const errorMap: { [key: string]: string } = {
      'auth/invalid-email': 'Ungültige E-Mail-Adresse',
      'auth/too-many-requests': 'Zu viele Versuche. Bitte später erneut versuchen',
      'auth/user-not-found': 'Wenn die E-Mail existiert, wurde eine Reset-Mail gesendet',
    };
    return errorMap[code] || 'Fehler beim Senden der E-Mail';
  }

  private scheduleHideMessage(delayMs: number) {
    setTimeout(() => {
      this.successVisible = false;
      this.errorMessage = '';
    }, delayMs);
  }
}