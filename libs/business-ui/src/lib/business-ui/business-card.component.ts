import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BusinessPageDto } from './models';

@Component({
  selector: 'lib-business-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './business-card.component.html',
  styleUrls: ['./business-card.component.scss'],
})
export class BusinessCardComponent {
  business = input.required<BusinessPageDto>();
}
