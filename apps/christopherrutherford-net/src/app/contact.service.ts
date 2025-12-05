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
    data.subject = `[Christopher Rutherford net] ${data.subject}`;
    return this.http.post('/api/contact', data);
  }
}
