import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-confirm-block',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent],
  templateUrl: './confirm-block.component.html',
  styleUrls: ['./confirm-block.component.scss'],
})
/**
 * Component for displaying a confirmation message and allowing resending of confirmation emails.
 */
export class ConfirmBlockComponent {
  /**
   * The header text for the confirmation block.
   */
  confirmHeader = 'Confirm Your Email';
  /**
   * The message displayed to the user regarding email confirmation.
   */
  confirmMessage = 'Please confirm your email address by clicking the link we sent to your email. If you did not receive the email, you can resend it below.';

  /**
   * Handles the resend confirmation email action.
   */
  onResend() {
    // Logic to resend the confirmation email
  }
}
