import { Component } from '@angular/core';

import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-confirm-block',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  templateUrl: './confirm-block.component.html',
  styleUrls: ['./confirm-block.component.scss'],
})
export class ConfirmBlockComponent {
  confirmHeader = 'Confirm Your Email';
  confirmMessage = 'Please confirm your email address by clicking the link we sent to your email. If you did not receive the email, you can resend it below.';

  onResend() {
    // Logic to resend the confirmation email
  }
}
