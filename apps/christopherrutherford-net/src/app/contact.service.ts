import { Injectable, inject } from '@angular/core';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/blogging-data-access';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private readonly blogging = inject(OptomisitcTanukiAPIService);

  postContact(data: {
    name: string;
    email: string;
    message: string;
    subject: string;
  }) {
    if (data.subject === '') data.subject = 'General Inquiry';
    return this.blogging.contactControllerCreateContact({
      ...data,
      subject: `[Christopher Rutherford net] ${data.subject}`,
      appScope: 'christopherrutherford-net',
      sourcePage: '/#contact',
      sourceLabel: 'Christopher Rutherford Net',
    });
  }
}
