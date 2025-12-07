import { Component, EventEmitter, Input, Output } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent, GridComponent } from '@optimistic-tanuki/common-ui';

export declare type LinkType = {
  url: string;
  title: string;
}

@Component({
  selector: 'lib-link',
  standalone: true,
  imports: [FormsModule, CardComponent, GridComponent, ButtonComponent],
  templateUrl: './link.component.html',
  styleUrls: ['./link.component.scss'],
})
export class LinkComponent {
  @Input() links: LinkType[] = [];
  @Output() linksChange = new EventEmitter<{ all: LinkType[], added?: LinkType, removed?: LinkType }>();
  linkValue = '';

  addLink() {
    if (this.linkValue.trim() === '') {
      return;
    }
    const title = this.linkValue;
    const newLink = { url: this.linkValue, title};
    this.links.push(newLink);
    this.linksChange.emit({ all: this.links, added: newLink });
    this.linkValue = '';
  }

  removeLink(link: LinkType) {
    const initialLength = this.links.length;
    this.links = this.links.filter(l => l !== link);
    if (this.links.length < initialLength) {
      this.linksChange.emit({ all: this.links, removed: link });
    }
  }
}
