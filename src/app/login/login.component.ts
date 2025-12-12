import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { LoginCardComponent } from './login-card/login-card.component';
import { RegisterCardComponent } from './register-card/register-card.component';
import { ChoseAvatarComponent } from './chose-avatar/chose-avatar.component';
import { NgIf } from '@angular/common';


@Component({
  selector: 'app-login',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    LoginCardComponent,
    RegisterCardComponent, NgIf,
    ChoseAvatarComponent
],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  debugMode = false;

  showLoginCardComponent = true;
  showRegisterCardComponent = false;
  showChoseAvatarComponent = false;

  openRegisterCard() {
    this.showLoginCardComponent = false;
    this.showRegisterCardComponent = true;
    this.showChoseAvatarComponent = false;
  }

  goToAvatarPicker() {
    this.showRegisterCardComponent = false;
    this.showChoseAvatarComponent = true;
  }

  backToRegister() {
    this.showChoseAvatarComponent = false;
    this.showRegisterCardComponent = true;
  }
}
