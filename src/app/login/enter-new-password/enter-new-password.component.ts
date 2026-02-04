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

  private auth = inject(Auth);
  private fb = inject(FormBuilder);

  resetForm: FormGroup;
  oobCode: string | null = null;
  email: string | null = null;
  errorMessage = '';
  successMessage = '';

  constructor() {
    this.resetForm = this.createForm();
  }

  ngOnInit() {
    this.oobCode = this.extractOobCode();
    if (!this.oobCode) {
      this.errorMessage = 'Ungültiger oder abgelaufener Reset-Link. Bitte erneut anfordern.';
      return;
    }
    this.verifyResetCode();
  }

  async onSubmit() {
    if (this.resetForm.invalid || !this.oobCode) return;

    const newPassword = this.resetForm.get('password')?.value;
    await this.confirmNewPassword(newPassword);
  }

  private createForm(): FormGroup {
    return this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordMatchValidator.bind(this) });
  }

  private extractOobCode(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('oobCode');
  }

  private verifyResetCode() {
    verifyPasswordResetCode(this.auth, this.oobCode!)
      .then((email) => this.email = email)
      .catch((err) => this.handleVerifyError(err));
  }

  private handleVerifyError(err: any) {
    this.errorMessage = 'Der Reset-Link ist ungültig oder abgelaufen.';
    console.error(err);
  }

  private async confirmNewPassword(newPassword: string) {
    try {
      await confirmPasswordReset(this.auth, this.oobCode!, newPassword);
      this.handleResetSuccess();
    } catch (err: any) {
      this.handleResetError(err);
    }
  }

  private handleResetSuccess() {
    this.successMessage = 'Passwort erfolgreich geändert! Sie werden zum Login weitergeleitet...';
    this.success.emit();
    this.scheduleReset(3000);
    this.resetForm.reset();
  }

  private handleResetError(err: any) {
    console.error('Passwort ändern fehlgeschlagen', err);
    this.errorMessage = err.message || 'Fehler beim Ändern des Passworts';
  }

  private scheduleReset(delayMs: number) {
    setTimeout(() => {
      this.successMessage = '';
    }, delayMs);
  }

  private passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirm = form.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }
}