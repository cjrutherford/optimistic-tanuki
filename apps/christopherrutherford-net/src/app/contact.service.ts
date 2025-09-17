import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ContactService {

  constructor(private http: HttpClient) { }

  postContact(data: {name: string; email: string; message: string, subject: string}) {
   if(data.subject === '') data.subject = 'General Inquiry';
   data.subject = `[Christopher Rutherford net] ${data.subject}`;
   return this.http.post('/api/contact', data);
  }
}
