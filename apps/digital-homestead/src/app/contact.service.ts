import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private readonly http = inject(HttpClient);


  postContact(data: {
    name: string;
    email: string;
    message: string;
    subject: string;
  }) {
    if (data.subject === '') data.subject = 'General Inquiry';
    data.subject = `[Digital Homestead] ${data.subject}`;
    return this.http.post('/api/contact', data);
  }
}
