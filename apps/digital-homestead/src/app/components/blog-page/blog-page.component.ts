import { Component } from '@angular/core';

import { BlogComposeComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'dh-blog-page',
  imports: [BlogComposeComponent],
  templateUrl: './blog-page.component.html',
  styleUrl: './blog-page.component.scss',
})
export class BlogPageComponent {
  onPostSubmitted(postData: any): void {
    console.log('Post submitted:', postData);
    // Here you would typically send the data to a backend service
  }
}
