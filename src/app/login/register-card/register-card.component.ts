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
import { Auth, createUserWithEmailAndPassword, updateProfile } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-register-card',
  imports: [MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    CommonModule,
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

    const { name, email, password } = this.form.value;

    try {
      // 1. User in Firebase Auth anlegen
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;

      // 2. DisplayName in Auth setzen (optional, aber sehr empfohlen)
      await updateProfile(user, { displayName: name.trim() });

      // 3. User-Dokument in Firestore anlegen – inkl. Passwort (wie aktuell bei dir)
      await setDoc(doc(this.firestore, 'users', user.uid), {
        uid: user.uid,
        name: name.trim(),
        email: email,
        password: password,               // ← bewusst noch drin, wie bei dir aktuell
        avatarUrl: '/public/images/avatars/default.svg', // oder leer
        role: 'member',
        status: 'active',
        online: true,
        createdAt: new Date().toISOString()
      });

      console.log('User erfolgreich erstellt mit UID:', user.uid);
      this.nextstep.emit();  // → weiter zu Avatar-Auswahl

    } catch (error: any) {
      console.error('Registrierung fehlgeschlagen:', error);

      let message = 'Etwas ist schiefgelaufen';

      if (error.code === 'auth/email-already-in-use') {
        message = 'Diese E-Mail-Adresse ist bereits registriert';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Ungültige E-Mail-Adresse';
      } else if (error.code === 'auth/weak-password') {
        message = 'Passwort ist zu schwach';

        alert(message);  // später → Snackbar/MatDialog
      }
    }
  }
}
