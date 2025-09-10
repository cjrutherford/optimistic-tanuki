# Blogging & Landing Page Components Plan

This document outlines a plan for implementing reusable components for blogs and landing pages, leveraging base components from `common-ui` and `social-ui` libraries.

---

## Goals

- Create modular, accessible, and visually appealing components for blog/landing page use.
- Promote reuse of existing UI primitives from `common-ui` and `social-ui`.
- Ensure easy integration and customization.

---

## Deliverables Checklist

- [x] **Hero Section Component**  
    - Uses: `glass-container`, `heading`, `button` (from `common-ui`)
- [x] **Blog Post Card Component**  
    - Uses: `card`, `button`, `heading`, `button` (from `common-ui`)
- [x] **Author Profile Component**  
    - Uses: `card`, `profile-photo`, `heading` (from `common-ui`)
- [ ] **Comments Section Component**  
    - Uses: `comment-list`, `comment`, `compose` (from `social-ui`)
- [ ] **Newsletter Signup Component**  
    - Uses: `modal`, `button`, `input` (from `common-ui`)
- [ ] **Contact Component**  
    - Uses: `card`, `button`, `input` (from `common-ui`)
- [ ] **Featured Posts Carousel**  
    - Uses: `carousel` (from `common-ui`), `post` (from `social-ui`)
- [ ] **Tag/Category List**  
    - Uses: `list` (from `common-ui`)
- [ ] **Social Sharing Buttons**  
    - Uses: `button` (from `common-ui`), icons (custom or from library)

---

## Implementation Examples

### 1. Hero Section Component

```tsx
// hero-section.component.ts
import { GlassContainerComponent, HeadingComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';

@Component({
    selector: 'app-hero-section',
    template: `
        <glass-container>
            <heading [level]="1">Welcome to Our Blog</heading>
            <p>Insights, stories, and updates.</p>
            <button variant="primary">Get Started</button>
        </glass-container>
    `
})
export class HeroSectionComponent {}
```

---

### 2. Blog Post Card Component

```tsx
// blog-post-card.component.ts
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { PostComponent } from '@optimistic-tanuki/social-ui';

@Component({
    selector: 'app-blog-post-card',
    template: `
        <card>
            <post [post]="postData"></post>
            <button variant="secondary">Read More</button>
        </card>
    `
})
export class BlogPostCardComponent {
    @Input() postData: Post;
}
```

---

### 3. Comments Section Component

```tsx
// comments-section.component.ts
import { CommentListComponent, ComposeComponent } from '@optimistic-tanuki/social-ui';

@Component({
    selector: 'app-comments-section',
    template: `
        <comment-list [comments]="comments"></comment-list>
        <compose (submit)="addComment($event)"></compose>
    `
})
export class CommentsSectionComponent {
    @Input() comments: Comment[];
    addComment(comment: Comment) { /* ... */ }
}
```

---

### 4. Author Profile Component

```tsx
// author-profile.component.ts
import { CardComponent, GradientBuilderComponent } from '@optimistic-tanuki/common-ui';

@Component({
    selector: 'app-author-profile',
    template: `
        <card>
            <gradient-builder>
                <div class="author-info">
                    <avatar [src]="author.avatarUrl"></avatar>
                    <h3>{{ author.name }}</h3>
                    <p>{{ author.bio }}</p>
                </div>
            </gradient-builder>
        </card>
    `
})
export class AuthorProfileComponent {
    @Input() author: { name: string; bio: string; avatarUrl: string };
}
```

---

### 5. Newsletter Signup Component

```tsx
// newsletter-signup.component.ts
import { ModalComponent, ButtonComponent, InputComponent } from '@optimistic-tanuki/common-ui';

@Component({
    selector: 'app-newsletter-signup',
    template: `
        <modal [open]="isOpen" (close)="isOpen = false">
            <h2>Subscribe to our Newsletter</h2>
            <input placeholder="Your email" [(ngModel)]="email" />
            <button variant="primary" (click)="subscribe()">Sign Up</button>
        </modal>
        <button variant="secondary" (click)="isOpen = true">Subscribe</button>
    `
})
export class NewsletterSignupComponent {
    isOpen = false;
    email = '';
    subscribe() { /* ... */ }
}
```

---

### 6. Featured Posts Carousel

```tsx
// featured-posts-carousel.component.ts
import { CarouselComponent } from '@optimistic-tanuki/common-ui';
import { PostComponent } from '@optimistic-tanuki/social-ui';

@Component({
    selector: 'app-featured-posts-carousel',
    template: `
        <carousel>
            <ng-container *ngFor="let post of featuredPosts">
                <post [post]="post"></post>
            </ng-container>
        </carousel>
    `
})
export class FeaturedPostsCarouselComponent {
    @Input() featuredPosts: Post[];
}
```

---

### 7. Tag/Category List

```tsx
// tag-category-list.component.ts
import { ListComponent } from '@optimistic-tanuki/common-ui';

@Component({
    selector: 'app-tag-category-list',
    template: `
        <list>
            <li *ngFor="let tag of tags">{{ tag }}</li>
        </list>
    `
})
export class TagCategoryListComponent {
    @Input() tags: string[];
}
```

---

### 8. Social Sharing Buttons

```tsx
// social-sharing-buttons.component.ts
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

@Component({
    selector: 'app-social-sharing-buttons',
    template: `
        <div class="social-buttons">
            <button *ngFor="let platform of platforms" (click)="share(platform)">
                <i [class]="platform.icon"></i> Share on {{ platform.name }}
            </button>
        </div>
    `
})
export class SocialSharingButtonsComponent {
    @Input() platforms: { name: string; icon: string }[];
    share(platform: any) { /* ... */ }
}
```

---

## Next Steps

- Review base components for additional features.
- Implement and test each deliverable.
- Document usage and customization options.

---

## References

- [`common-ui` library](../libs/common-ui/README.md)
- [`social-ui` library](../libs/social-ui/README.md)

