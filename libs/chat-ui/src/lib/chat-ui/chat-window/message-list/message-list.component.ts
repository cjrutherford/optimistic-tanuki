import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'lib-message-list',
  imports: [CommonModule],
  templateUrl: './message-list.component.html',
  styleUrls: ['./message-list.component.scss'],
})
export class MessageListComponent {
  messages = [
    { sender: 'Alice', text: 'Hi there!' },
    { sender: 'Bob', text: 'Hello!' },
    { sender: 'Alice', text: 'How are you?' },
    { sender: 'Bob', text: 'Doing well, thanks!' },
  ];
}
