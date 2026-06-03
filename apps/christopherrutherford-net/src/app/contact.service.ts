import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private http = inject(HttpClient);

  postContact(data: {
    name: string;
    email: string;
    message: string;
    subject: string;
  }) {
    if (data.subject === '') data.subject = 'General Inquiry';
    return this.http.post('/api/contact', {
      ...data,
      subject: `[Christopher Rutherford net] ${data.subject}`,
      appScope: 'christopherrutherford-net',
      sourcePage: '/#contact',
      sourceLabel: 'Christopher Rutherford Net',
    });
  }
}
