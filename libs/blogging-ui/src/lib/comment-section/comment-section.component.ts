import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import { CommentComponent, CommentListComponent } from '@optimistic-tanuki/social-ui';

@Component({
  selector: 'lib-comment-section',
  imports: [CommonModule, CardComponent, CommentComponent, CommentListComponent],
  templateUrl: './comment-section.component.html',
  styleUrl: './comment-section.component.scss',
})
export class CommentSectionComponent {}
