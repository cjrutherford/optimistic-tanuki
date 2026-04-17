import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ot-transaction-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="transaction-form">
      <h2>Transaction Form</h2>
      <p>Transaction form component</p>
    </div>
  `,
})
export class TransactionFormComponent {}
