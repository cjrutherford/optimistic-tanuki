import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BlogComposeComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'dh-blog-page',
  imports: [BlogComposeComponent],
  templateUrl: './blog-page.component.html',
  styleUrl: './blog-page.component.scss',
})
export class BlogPageComponent {
  route: ActivatedRoute = inject(ActivatedRoute);
  postId?: string | null = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.postId = params['postId'] || null;
    });
  }
  onPostSubmitted(postData: any): void {
    console.log('Post submitted:', postData);
    // Here you would typically send the data to a backend service
  }
}
