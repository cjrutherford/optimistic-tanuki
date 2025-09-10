# Plan: Blogging-Specific UI Elements (Based on `common-ui` and `social-ui` Libraries)

## Goals
- Create reusable blogging UI components.
- Leverage existing `common-ui` and `social-ui` components for consistency.
- Integrate with theme and variant systems for configurable display.

## Steps

### 1. Identify Blogging UI Needs
- Blog Post Card (title, excerpt, author, date, image)
- Author Profile (avatar, bio, social links)
- Tag/Category Chips
- Comment Section (threaded, reply, like)
- Post Navigation (previous/next, breadcrumbs)
- Featured Post Carousel
- Reading Progress Bar
- Share Buttons
- Social Interactions (votes, attachments, compose, links)

### 2. Map to Existing Components
- Use `common-ui`: card, avatar, button, breadcrumb, carousel, list, modal, etc.
- Use `social-ui`: comment, comment-list, vote, attachment, compose, link, post.
- Extend or compose as needed for blogging context.

### 3. Theme & Variant Integration
- Ensure all new components accept theme/variant props.
- Use `theme.interface.ts` and `variantable.interface.ts` for configuration.

### 4. Implementation Approach
- Create new folders under `libs/common-ui/src/lib/blogging/` for each blogging element.
- Integrate relevant components from `libs/social-ui/src/lib/social-ui/`.
- Use Storybook for isolated development and documentation.
- Write unit tests for each component.

### 5. Example Component Breakdown
| Blogging Element         | Base Component(s)                        | Theme/Variant Support |
|-------------------------|-------------------------------------------|----------------------|
| Blog Post Card          | card, image, button, post (social-ui)     | Yes                  |
| Author Profile          | avatar, card, button                      | Yes                  |
| Tag/Category Chip       | button, list                              | Yes                  |
| Comment Section         | comment, comment-list (social-ui), modal  | Yes                  |
| Post Navigation         | breadcrumb, button                        | Yes                  |
| Featured Carousel       | carousel, card                            | Yes                  |
| Progress Bar            | spinner, custom                           | Yes                  |
| Share Buttons           | button                                    | Yes                  |
| Social Interactions     | vote, attachment, compose, link (social-ui)| Yes                  |

### 6. Next Steps
- Prioritize components by blogging workflow.
- Draft API for each component (props, events, theme/variant options).
- Begin implementation with Blog Post Card as MVP, integrating both `common-ui` and `social-ui` elements.

---

**Note:** All new components should be documented in Storybook and tested for theme/variant compatibility.

