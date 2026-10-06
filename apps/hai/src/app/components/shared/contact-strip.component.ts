import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CONTACT_DETAILS } from '../../content/contact-details';

/** Phone, email, and contact page, shown at the foot of every page. */
@Component({
  selector: 'hai-contact-strip',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './contact-strip.component.html',
  styleUrl: './contact-strip.component.scss',
})
export class ContactStripComponent {
  readonly contact = CONTACT_DETAILS;
}
