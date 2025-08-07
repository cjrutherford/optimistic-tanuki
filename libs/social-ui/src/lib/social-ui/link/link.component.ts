import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent, GridComponent } from '@optimistic-tanuki/common-ui';

/**
 * Represents a link with a URL and a title.
 */
export declare type LinkType = {
  /**
   * The URL of the link.
   */
  url: string;
  /**
   * The title of the link.
   */
  title: string;
}

/**
 * Component for managing a list of links.
 */
@Component({
  selector: 'lib-link',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, GridComponent, ButtonComponent],
  templateUrl: './link.component.html',
  styleUrls: ['./link.component.scss'],
})
export class LinkComponent {
  /**
   * Input property for the list of links.
   */
  @Input() links: LinkType[] = [];
  /**
   * Emits changes to the links list (all, added, removed).
   */
  @Output() linksChange = new EventEmitter<{ all: LinkType[], added?: LinkType, removed?: LinkType }>();
  /**
   * The current value of the link input field.
   */
  linkValue = '';

  /**
   * Adds a new link to the list.
   */
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

  /**
   * Removes a link from the list.
   * @param link The link to remove.
   */
  removeLink(link: LinkType) {
    const initialLength = this.links.length;
    this.links = this.links.filter(l => l !== link);
    if (this.links.length < initialLength) {
      this.linksChange.emit({ all: this.links, removed: link });
    }
  }
}
