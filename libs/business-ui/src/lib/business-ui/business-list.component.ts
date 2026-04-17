import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BusinessPageDto } from './models';
import { BusinessCardComponent } from './business-card.component';

@Component({
  selector: 'lib-business-list',
  standalone: true,
  imports: [CommonModule, BusinessCardComponent],
  templateUrl: './business-list.component.html',
  styleUrls: ['./business-list.component.scss'],
})
export class BusinessListComponent {
  businesses = input<BusinessPageDto[]>([]);
  loading = input<boolean>(false);
  showCreateButton = input<boolean>(false);

  createClicked = output<void>();
  businessClicked = output<BusinessPageDto>();
}
