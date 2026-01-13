import { Component, Output, EventEmitter, inject } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-chose-avatar',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    CommonModule],
  templateUrl: './chose-avatar.component.html',
  styleUrl: './chose-avatar.component.scss'
})
export class ChoseAvatarComponent {

  @Output() back = new EventEmitter<void>();
  @Output() success = new EventEmitter<void>();

  private auth = inject(Auth);
  private firestore = inject(Firestore);


  avatarlist = [
    'public/images/avatars/avatar1.svg',
    'public/images/avatars/avatar2.svg',
    'public/images/avatars/avatar3.svg',
    'public/images/avatars/avatar4.svg',
    'public/images/avatars/avatar5.svg',
    'public/images/avatars/avatar6.svg',
  ];

  chosenAvatarSrc = 'public/images/avatars/avatar-default.svg';

  selectedIndex = 0

  successVisible = false;

  selectAvatar(src: string, index: number) {
    this.chosenAvatarSrc = src;
    this.selectedIndex = index;
  }

  async saveAndFinish() {
    const user = this.auth.currentUser;

    if (!user) {
      alert('Kein angemeldeter Benutzer gefunden. Bitte neu einloggen.');
      return;
    }

    if (this.chosenAvatarSrc === 'public/images/avatars/avatar-default.svg') {
      alert('Bitte wähle einen Avatar aus!');
      return;
    }

    try {
      const userRef = doc(this.firestore, 'users', user.uid);

      await updateDoc(userRef, {
        avatarUrl: this.chosenAvatarSrc
      });

      console.log('Avatar gespeichert:', this.chosenAvatarSrc);

      // Erfolgsanzeige + Weiterleitung
      this.successVisible = true;

      setTimeout(() => {
        this.successVisible = false;
        this.success.emit();  // → z. B. zurück zum Login oder Dashboard
      }, 3000);

    } catch (error) {
      console.error('Fehler beim Speichern des Avatars:', error);
      alert('Avatar konnte nicht gespeichert werden. Versuch es später nochmal.');
    }
  }
}

