import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ContactService {

  constructor(private readonly http: HttpClient) { }

  postContact(data: {name: string; email: string; message: string, subject: string}) {
   if(data.subject === '') data.subject = 'General Inquiry';
   data.subject = `[Digital Homestead] ${data.subject}`;
   return this.http.post('/api/contact', data);
  }
}
