import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeHostBindingsDirective } from '@optimistic-tanuki/theme-lib';

export interface DonationRequest {
  amount: number;
  message?: string;
  anonymous: boolean;
}

@Component({
  selector: 'store-donation',
  standalone: true,
  imports: [CommonModule, FormsModule, ThemeHostBindingsDirective],
  templateUrl: './donation.component.html',
  styleUrls: ['./donation.component.scss'],
  hostDirectives: [ThemeHostBindingsDirective],
})
export class DonationComponent {
  @Output() donate = new EventEmitter<DonationRequest>();

  amount: number = 10;
  customAmount: number | null = null;
  message: string = '';
  anonymous: boolean = false;
  presetAmounts = [5, 10, 25, 50, 100];

  selectAmount(amount: number): void {
    this.amount = amount;
    this.customAmount = null;
  }

  useCustomAmount(): void {
    if (this.customAmount && this.customAmount > 0) {
      this.amount = this.customAmount;
    }
  }

  onSubmit(): void {
    if (this.amount > 0) {
      this.donate.emit({
        amount: this.amount,
        message: this.message || undefined,
        anonymous: this.anonymous,
      });
    }
  }
}
