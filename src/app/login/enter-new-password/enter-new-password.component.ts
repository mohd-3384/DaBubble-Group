import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Auth, verifyPasswordResetCode, confirmPasswordReset } from '@angular/fire/auth';

@Component({
  selector: 'app-enter-new-password',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    ReactiveFormsModule,
  ],
  templateUrl: './enter-new-password.component.html',
  styleUrl: './enter-new-password.component.scss',
})
export class EnterNewPasswordComponent {
  @Output() success = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  private auth = inject(Auth);
  private fb = inject(FormBuilder);

  resetForm: FormGroup;
  oobCode: string | null = null;
  email: string | null = null;
  errorMessage = '';
  successMessage = '';

  /** Initializes the component with password reset form. */
  constructor() {
    this.resetForm = this.createForm();
  }

  /** Angular lifecycle hook that extracts oobCode and verifies the password reset code. */
  ngOnInit() {
    this.oobCode = this.extractOobCode();
    if (!this.oobCode) {
      this.errorMessage = 'Ungültiger oder abgelaufener Reset-Link. Bitte erneut anfordern.';
      return;
    }
    this.verifyResetCode();
  }

  /** Validates new password form and confirms password reset with Firebase, then emits success. */
  async onSubmit() {
    if (this.resetForm.invalid || !this.oobCode) return;

    const newPassword = this.resetForm.get('password')?.value;
    await this.confirmNewPassword(newPassword);
  }

  /** Creates a FormGroup with password and confirmPassword fields with password match validation. */
  private createForm(): FormGroup {
    return this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordMatchValidator.bind(this) });
  }

  /** Extracts the oobCode (one-time-use code) from URL query parameters. */
  private extractOobCode(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('oobCode');
  }

  /** Verifies the password reset code with Firebase and retrieves associated email. */
  private verifyResetCode() {
    verifyPasswordResetCode(this.auth, this.oobCode!)
      .then((email) => this.email = email)
      .catch((err) => this.handleVerifyError(err));
  }

  /** Handles password reset code verification errors by displaying error message. */
  private handleVerifyError(err: any) {
    this.errorMessage = 'Der Reset-Link ist ungülttig oder abgelaufen.';
    console.error(err);
  }

  /** Confirms new password with Firebase using oobCode, then handles success or error. */
  private async confirmNewPassword(newPassword: string) {
    try {
      await confirmPasswordReset(this.auth, this.oobCode!, newPassword);
      this.handleResetSuccess();
    } catch (err: any) {
      this.handleResetError(err);
    }
  }

  /** Displays success message, emits success event, and schedules redirect to login. */
  private handleResetSuccess() {
    this.successMessage = 'Passwort erfolgreich geändert! Sie werden zum Login weitergeleitet...';
    this.success.emit();
    this.scheduleReset(3000);
    this.resetForm.reset();
  }

  /** Handles password reset errors and displays error message to user. */
  private handleResetError(err: any) {
    console.error('Passwort ändern fehlgeschlagen', err);
    this.errorMessage = err.message || 'Fehler beim Ändern des Passworts';
  }

  /** Clears success message after specified delay in milliseconds. */
  private scheduleReset(delayMs: number) {
    setTimeout(() => {
      this.successMessage = '';
    }, delayMs);
  }

  /** Custom validator that checks if password and confirmPassword fields match. */
  private passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirm = form.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }
}