
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageListComponent } from './message-list/message-list.component';
import { ParticipantsComponent } from './participants/participants.component';

@Component({
  selector: 'lib-chat-window',
  standalone: true,
  imports: [CommonModule, MessageListComponent, ParticipantsComponent],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
})
export class ChatWindowComponent {
  @Input() contact: any;
  @Input() messages: any[] = [];  
  isFullScreen = false;
  isPopout = false;

  toggleFullScreen() {
    this.isFullScreen = !this.isFullScreen;
    if (this.isFullScreen) {
      this.isPopout = false;
    }
  }

  togglePopout() {
    this.isPopout = !this.isPopout;
    if (this.isPopout) {
      this.isFullScreen = false;
    }
  }
}
