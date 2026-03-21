import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BusinessPageDto } from './models';

@Component({
  selector: 'lib-business-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './business-detail.component.html',
  styleUrls: ['./business-detail.component.scss'],
})
export class BusinessDetailComponent {
  business = input.required<BusinessPageDto>();
  isOwner = input<boolean>(false);

  editClicked = output<void>();
}
