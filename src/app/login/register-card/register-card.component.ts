import { Component } from '@angular/core';
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

  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.pattern('^[a-zA-Z -]+$')] ],
    email: ['', [Validators.required, Validators.email] ],
    password: ['', [Validators.required, Validators.minLength(6), Validators.pattern('^(?=.*[A-Z])(?=.*[!@#$&*]).{6,}$')] ],
    terms: [false, [Validators.requiredTrue] ],
  });
  }

  onsubmit() {
    if (this.form.valid) {
      console.log('Form Submitted!', this.form.value);
    }
  }

}
