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

  async onSubmit() {
    if (this.form.invalid) return;

    const name = String(this.form.value.name ?? '').trim();
    const email = String(this.form.value.email ?? '').trim();
    const password = String(this.form.value.password ?? '');

    try {
      // 1) Firebase Auth user anlegen
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;

      // 2) DisplayName setzen (optional aber gut)
      await updateProfile(user, { displayName: name });

      // 3) Firestore user doc (OHNE Passwort!)
      await setDoc(doc(this.firestore, 'users', user.uid), {
        uid: user.uid,
        name,
        email,
        avatarUrl: '/public/images/avatars/avatar-default.svg',
        role: 'member',
        status: 'active',
        online: true,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      }, { merge: true });

      this.nextstep.emit();
    } catch (error: any) {
      console.error('Registrierung fehlgeschlagen:', error);

      let message = 'Etwas ist schiefgelaufen';
      if (error?.code === 'auth/email-already-in-use') message = 'Diese E-Mail-Adresse ist bereits registriert';
      else if (error?.code === 'auth/invalid-email') message = 'Ungültige E-Mail-Adresse';
      else if (error?.code === 'auth/weak-password') message = 'Passwort ist zu schwach';

      alert(message);
    }
  }
}
