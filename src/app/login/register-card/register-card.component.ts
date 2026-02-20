import { Component, Output, EventEmitter, inject } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Auth, createUserWithEmailAndPassword, updateProfile } from '@angular/fire/auth';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-register-card',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    CommonModule,
    RouterLink,
  ],
  templateUrl: './register-card.component.html',
  styleUrls: ['./register-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterCardComponent {
  @Output() nextstep = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  private auth = inject(Auth);
  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.pattern('^[a-zA-Z -]+$')]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6), Validators.pattern('^(?=.*[A-Z])(?=.*[!@#$&*]).{6,}$')]],
      terms: [false, [Validators.requiredTrue]],
    });
  }

  /** Validates form and creates new user in Firebase Auth and Firestore, then emits nextstep. */
  async onSubmit() {
    if (this.form.invalid) return;
    try {
      const userCredential = await this.createFirebaseUser();
      await this.createFirestoreUser(userCredential.user);
      this.nextstep.emit();
    } catch (error: any) {
      this.handleRegistrationError(error);
    }
  }

  /** Creates new user in Firebase Auth with email and password, then updates profile display name. */
  private async createFirebaseUser() {
    const { name, email, password } = this.form.value;
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    return userCredential;
  }

  /** Creates user document in Firestore with registration data and default avatar. */
  private async createFirestoreUser(user: any) {
    await setDoc(doc(this.firestore, 'users', user.uid), {
      uid: user.uid,
      name: String(this.form.value.name).trim(),
      email: String(this.form.value.email).trim(),
      avatarUrl: '/public/images/avatars/avatar-default.svg',
      role: 'member',
      status: 'active',
      online: true,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    }, { merge: true });
  }

  /** Displays user-friendly error message based on registration exception code. */
  private handleRegistrationError(error: any) {
    const message = this.getRegistrationErrorMessage(error?.code);
    alert(message);
  }

  /** Maps Firebase error codes to German error messages for user display. */
  private getRegistrationErrorMessage(code: string): string {
    const messages: { [key: string]: string } = {
      'auth/email-already-in-use': 'Diese E-Mail ist bereits registriert',
      'auth/invalid-email': 'Ungültige E-Mail-Adresse',
      'auth/weak-password': 'Passwort ist zu schwach',
    };
    return messages[code] || 'Registrierung fehlgeschlagen';
  }
}
