import { Component, inject } from '@angular/core';
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
    MatCardModule,
    CommonModule,
    MatIconModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss',
})
export class PasswordResetComponent {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);

  resetForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  successMsg = '';
  errorMsg = '';

  async onSubmit() {
    this.successMsg = '';
    this.errorMsg = '';

    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const email = String(this.resetForm.value.email || '').trim();

    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      };

      await sendPasswordResetEmail(this.auth, email, actionCodeSettings);

      this.successMsg =
        'E-Mail wurde gesendet. Nach dem Zurücksetzen wirst du zum Login weitergeleitet.';
      this.resetForm.reset();
    } catch (err: any) {
      console.error('[PasswordReset] failed', err);

      const code = err?.code ?? 'unknown';

      if (code === 'auth/user-not-found') {
        // Security Best Practice
        this.successMsg =
          'Wenn die E-Mail existiert, wurde eine Reset-Mail gesendet.';
      } else if (code === 'auth/invalid-email') {
        this.errorMsg = 'Ungültige E-Mail-Adresse.';
      } else if (code === 'auth/too-many-requests') {
        this.errorMsg = 'Zu viele Versuche. Bitte später erneut versuchen.';
      } else {
        this.errorMsg = 'Reset-Mail konnte nicht gesendet werden.';
      }
    }
  }
}
