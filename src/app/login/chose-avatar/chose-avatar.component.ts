import { Component, Output, EventEmitter, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { Auth, updateProfile } from '@angular/fire/auth';
import { Firestore, doc, updateDoc, serverTimestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-chose-avatar',
  standalone: true,
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
  ],
  templateUrl: './chose-avatar.component.html',
  styleUrl: './chose-avatar.component.scss',
})
export class ChoseAvatarComponent implements OnInit {
  @Output() back = new EventEmitter<void>();
  @Output() success = new EventEmitter<void>();

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  userName = signal<string>('Benutzer');
  avatarlist = [
    '/public/images/avatars/avatar1.svg',
    '/public/images/avatars/avatar2.svg',
    '/public/images/avatars/avatar3.svg',
    '/public/images/avatars/avatar4.svg',
    '/public/images/avatars/avatar5.svg',
    '/public/images/avatars/avatar6.svg',
  ];

  chosenAvatarSrc = '/public/images/avatars/avatar-default.svg';
  selectedIndex = -1;

  ngOnInit() {
    this.loadUserName();
  }

  private loadUserName() {
    const user = this.auth.currentUser;
    if (user?.displayName) {
      this.userName.set(user.displayName);
    }
  }

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

    if (this.isDefaultAvatar()) {
      alert('Bitte wähle einen Avatar aus!');
      return;
    }

    await this.updateAvatarForUser(user);
  }

  private isDefaultAvatar(): boolean {
    return this.chosenAvatarSrc === '/public/images/avatars/avatar-default.svg';
  }

  private async updateAvatarForUser(user: any) {
    try {
      await this.updateUserDocument(user.uid);
      await updateProfile(user, { photoURL: this.chosenAvatarSrc });
      this.success.emit();
    } catch (error) {
      alert('Avatar konnte nicht gespeichert werden.');
    }
  }

  private async updateUserDocument(uid: string) {
    const userRef = doc(this.firestore, 'users', uid);
    await updateDoc(userRef, {
      avatarUrl: this.chosenAvatarSrc,
      lastSeen: serverTimestamp(),
    });
  }
}
