import { Component, Output, EventEmitter } from '@angular/core';
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

  selectAvatar(src: string) {
    this.chosenAvatarSrc = src;
  }
}
