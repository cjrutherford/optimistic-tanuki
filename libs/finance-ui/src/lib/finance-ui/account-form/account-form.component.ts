import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ot-account-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="account-form">
      <h2>Account Form</h2>
      <p>Account form component</p>
    </div>
  `,
})
export class AccountFormComponent {}
