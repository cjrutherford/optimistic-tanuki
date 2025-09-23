import { Component, EventEmitter, Input, Output } from '@angular/core';

import { ButtonComponent, CardComponent, HeadingComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'lib-newsletter-signup',
  imports: [
    ModalComponent,
    ButtonComponent,
    TextInputComponent,
    CardComponent,
    HeadingComponent
],
  templateUrl: './newsletter-signup.component.html',
  styleUrl: './newsletter-signup.component.scss',
})
export class NewsletterSignupComponent {
  @Input() bannerImage = 'https://picsum.photos/1200/300';
  @Output() signUp = new EventEmitter<string>();
  email = '';
  isModalOpen = false;

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  submit() {
    if (this.email) {
      this.signUp.emit(this.email);
      this.email = '';
      this.closeModal();
    }
  }
}
