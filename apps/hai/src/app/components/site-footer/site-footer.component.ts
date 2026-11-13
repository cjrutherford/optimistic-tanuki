import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CONTACT_DETAILS } from '../../content/contact-details';
import { HEADER_LINKS } from '../../content/navigation';
import { SITE_NAME } from '../../content/seo';

/** The page footer: key pages, how to reach us, and the copyright line. */
@Component({
  selector: 'hai-site-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './site-footer.component.html',
  styleUrl: './site-footer.component.scss',
})
export class SiteFooterComponent {
  readonly contact = CONTACT_DETAILS;
  readonly links = HEADER_LINKS;
  readonly siteName = SITE_NAME;
  readonly year = new Date().getFullYear();
}
