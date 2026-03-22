import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreateBusinessPageDto } from './models';

@Component({
  selector: 'lib-create-business',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-business.component.html',
  styleUrls: ['./create-business.component.scss'],
})
export class CreateBusinessComponent {
  localityId = input.required<string>();
  localityName = input<string>('');
  submitting = input<boolean>(false);

  created = output<CreateBusinessPageDto>();
  cancelled = output<void>();

  name = '';
  description = '';
  website = '';
  phone = '';
  email = '';
  address = '';
  tier = signal<'basic' | 'pro' | 'enterprise'>('basic');

  onSubmit(): void {
    if (!this.name.trim()) return;
    this.created.emit({
      name: this.name.trim(),
      description: this.description.trim() || undefined,
      website: this.website.trim() || undefined,
      phone: this.phone.trim() || undefined,
      email: this.email.trim() || undefined,
      address: this.address.trim() || undefined,
      tier: this.tier(),
      localityId: this.localityId(),
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
