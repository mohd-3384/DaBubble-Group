import { Component, Output, EventEmitter, inject, signal, OnDestroy } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators, FormGroup, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Auth, createUserWithEmailAndPassword, updateProfile, deleteUser } from '@angular/fire/auth';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { UserService } from '../../services/user.service';
import { Subject, from, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, takeUntil } from 'rxjs/operators';

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
export class RegisterCardComponent implements OnDestroy {
  @Output() nextstep = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  private auth = inject(Auth);
  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);
  private userSvc = inject(UserService);

  form: FormGroup;
  registrationError = signal<string>('');
  showPassword = signal(false);
  nameStatus = signal<'idle' | 'checking' | 'available' | 'taken'>('idle');
  private destroy$ = new Subject<void>();

  /** Toggles password field visibility. */
  togglePassword() { this.showPassword.update(v => !v); }

  get pwValue(): string { return this.form.get('password')?.value ?? ''; }
  get pwTooShort(): boolean { return this.pwValue.length < 6; }
  get pwMissingUpper(): boolean { return !/[A-Z]/.test(this.pwValue); }
  get pwMissingSpecial(): boolean { return !/[!@#$&*]/.test(this.pwValue); }
  get pwTouched(): boolean { return !!this.form.get('password')?.touched; }
  get showPwErrors(): boolean { return this.pwTouched && (this.pwTooShort || this.pwMissingUpper || this.pwMissingSpecial || !this.pwValue); }

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.pattern('^[a-zA-Z -]+$')]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6), Validators.pattern('^(?=.*[A-Z])(?=.*[!@#$&*]).{6,}$')]],
      terms: [false, [Validators.requiredTrue]],
    });
    this.bindNameCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Validates form and creates new user in Firebase Auth and Firestore, then emits nextstep. */
  async onSubmit() {
    if (this.form.invalid) return;
    this.registrationError.set('');
    try {
      const userCredential = await this.createFirebaseUser();
      const name = String(this.form.value.name ?? '').trim();
      const nameTaken = await this.userSvc.isUserNameTaken(name, userCredential.user.uid);
      if (nameTaken) {
        await deleteUser(userCredential.user);
        this.setDuplicateError(this.form.get('name'), true);
        this.form.get('name')?.markAsTouched();
        this.nameStatus.set('taken');
        return;
      }
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

  private bindNameCheck(): void {
    const ctrl = this.form.get('name');
    if (!ctrl) return;

    ctrl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap((value) => {
        const name = String(value ?? '').trim();
        const errors = ctrl.errors ?? {};
        const hasBaseErrors = Object.keys(errors).some((k) => k !== 'duplicate');
        if (!name || hasBaseErrors) {
          this.nameStatus.set('idle');
          this.setDuplicateError(ctrl, false);
          return of(null);
        }
        this.nameStatus.set('checking');
        return from(this.userSvc.isUserNameTaken(name)).pipe(
          map((taken) => ({ taken })),
          catchError(() => of({ taken: false, error: true }))
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((result) => {
      if (!result) return;
      if ((result as any).error) {
        this.nameStatus.set('idle');
        return;
      }
      if (result.taken) {
        this.setDuplicateError(ctrl, true);
        ctrl.markAsTouched();
        this.nameStatus.set('taken');
        return;
      }
      this.setDuplicateError(ctrl, false);
      this.nameStatus.set('available');
    });
  }

  private setDuplicateError(ctrl: AbstractControl | null, isDuplicate: boolean): void {
    if (!ctrl) return;
    const errors = ctrl.errors ?? {};
    if (isDuplicate) {
      if (!errors['duplicate']) {
        ctrl.setErrors({ ...errors, duplicate: true });
      }
      return;
    }
    if (!errors['duplicate']) return;
    const { duplicate, ...rest } = errors;
    ctrl.setErrors(Object.keys(rest).length ? rest : null);
  }

  /** Displays user-friendly error message based on registration exception code. */
  private handleRegistrationError(error: any) {
    const message = this.getRegistrationErrorMessage(error?.code);
    this.registrationError.set(message);
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
