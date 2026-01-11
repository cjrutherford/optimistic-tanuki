# Blog Features Testing Guide

## Quick Reference for Testing Item 6 Features

### Prerequisites

1. Start the blogging service and gateway:

```bash
# Standard stack
docker-compose up -d

# Or build and run specific services
npx nx build blogging
npx nx build gateway
```

2. Ensure you have some published blog posts in the database

### 1. Test RSS Feed Generation

#### Via curl

```bash
curl -X GET "http://localhost:3000/post/rss/feed.xml" \
  -H "Accept: application/rss+xml"
```

#### Expected Response

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Optimistic Tanuki Blog</title>
    <description>A collection of thoughts and tutorials</description>
    <link>https://blog.optimistic-tanuki.com</link>
    <item>
      <title><![CDATA[Your Post Title]]></title>
      <description><![CDATA[Post description...]]></description>
      <content:encoded><![CDATA[<p>Full HTML content...</p>]]></content:encoded>
    </item>
  </channel>
</rss>
```

#### RSS Validation

1. Save the RSS output to a file:

   ```bash
   curl "http://localhost:3000/post/rss/feed.xml" > feed.xml
   ```

2. Validate at https://validator.w3.org/feed/
   - Upload the feed.xml file
   - Verify it passes RSS 2.0 validation

### 2. Test Search Functionality

#### Search for posts

```bash
# Basic search
curl -X GET "http://localhost:3000/post/search?q=typescript"

# Search with spaces
curl -X GET "http://localhost:3000/post/search?q=web%20development"

# Empty search (should return empty array)
curl -X GET "http://localhost:3000/post/search?q="
```

#### Expected Response

```json
[
  {
    "id": "uuid",
    "title": "Post Title Containing 'typescript'",
    "content": "<p>Content with typescript...</p>",
    "authorId": "author-uuid",
    "isDraft": false,
    "publishedAt": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 3. Test SEO Metadata Generation

#### Get SEO metadata for a post

```bash
# Replace {post-id} with an actual post ID
curl -X GET "http://localhost:3000/post/{post-id}/seo?baseUrl=https://blog.example.com"
```

#### Expected Response

```json
{
  "title": "Post Title",
  "description": "First 160 characters of content...",
  "author": "author-uuid",
  "publishedTime": "2024-01-01T00:00:00.000Z",
  "modifiedTime": "2024-01-01T00:00:00.000Z",
  "ogTitle": "Post Title",
  "ogDescription": "First 160 characters...",
  "ogUrl": "https://blog.example.com/post/uuid",
  "ogType": "article",
  "twitterCard": "summary_large_image",
  "twitterTitle": "Post Title",
  "twitterDescription": "First 160 characters..."
}
```

#### Using in HTML

```html
<head>
  <title>{{ seoMetadata.title }}</title>
  <meta name="description" content="{{ seoMetadata.description }}" />

  <!-- Open Graph -->
  <meta property="og:title" content="{{ seoMetadata.ogTitle }}" />
  <meta property="og:description" content="{{ seoMetadata.ogDescription }}" />
  <meta property="og:url" content="{{ seoMetadata.ogUrl }}" />
  <meta property="og:type" content="{{ seoMetadata.ogType }}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="{{ seoMetadata.twitterCard }}" />
  <meta name="twitter:title" content="{{ seoMetadata.twitterTitle }}" />
  <meta name="twitter:description" content="{{ seoMetadata.twitterDescription }}" />
</head>
```

### 4. Test Sitemap Generation

#### Get sitemap

```bash
curl -X GET "http://localhost:3000/blog/sitemap.xml"
```

#### Expected Response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://blog.optimistic-tanuki.com</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://blog.optimistic-tanuki.com/post/uuid</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

#### Sitemap Validation

1. Save the sitemap:

   ```bash
   curl "http://localhost:3000/blog/sitemap.xml" > sitemap.xml
   ```

2. Validate at https://www.xml-sitemaps.com/validate-xml-sitemap.html

3. Submit to search engines:
   - Google Search Console: https://search.google.com/search-console
   - Bing Webmaster Tools: https://www.bing.com/webmasters

### 5. Test Spam Protection on Contact Form

#### Test 1: Valid Submission

```bash
curl -X POST "http://localhost:3000/contact" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "message": "This is a legitimate message with proper content.",
    "honeypot": ""
  }'
```

**Expected:** Success (200 OK)

#### Test 2: Honeypot Detection

```bash
curl -X POST "http://localhost:3000/contact" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Bot",
    "email": "bot@example.com",
    "message": "Spam message",
    "honeypot": "bot-filled-this"
  }'
```

**Expected:** Error (400) - "Spam detected: Honeypot field was filled"

#### Test 3: Spam Keyword Detection

```bash
curl -X POST "http://localhost:3000/contact" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Spammer",
    "email": "spam@example.com",
    "message": "Buy viagra now for cheap!",
    "honeypot": ""
  }'
```

**Expected:** Error (400) - "Spam detected: Contains spam keyword"

#### Test 4: Too Many URLs

```bash
curl -X POST "http://localhost:3000/contact" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Link Farmer",
    "email": "links@example.com",
    "message": "Check http://link1.com http://link2.com http://link3.com http://link4.com",
    "honeypot": ""
  }'
```

**Expected:** Error (400) - "Spam detected: Too many URLs in message"

#### Test 5: Message Too Short

```bash
curl -X POST "http://localhost:3000/contact" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "John",
    "email": "john@example.com",
    "message": "Hi",
    "honeypot": ""
  }'
```

**Expected:** Error (400) - "Validation failed: Message is too short"

#### Test 6: Invalid Email

```bash
curl -X POST "http://localhost:3000/contact" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "invalid-email",
    "message": "This is a valid message",
    "honeypot": ""
  }'
```

**Expected:** Error (400) - "Validation failed: Invalid email format"

#### Test 7: Suspicious Email Provider

```bash
curl -X POST "http://localhost:3000/contact" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "test@tempmail.com",
    "message": "This is my message with proper length",
    "honeypot": ""
  }'
```

**Expected:** Error (400) - "Spam detected: Suspicious email provider"

### Frontend Integration Example

#### Contact Form with Honeypot

```html
<form (ngSubmit)="onSubmit()">
  <!-- Visible fields -->
  <input type="text" [(ngModel)]="contactForm.name" placeholder="Name" required />
  <input type="email" [(ngModel)]="contactForm.email" placeholder="Email" required />
  <textarea [(ngModel)]="contactForm.message" placeholder="Message" required></textarea>

  <!-- Honeypot field (hidden with CSS) -->
  <input type="text" [(ngModel)]="contactForm.honeypot" name="website" style="position: absolute; left: -9999px;" tabindex="-1" autocomplete="off" />

  <button type="submit">Send</button>
</form>
```

```typescript
export class ContactComponent {
  contactForm = {
    name: '',
    email: '',
    message: '',
    honeypot: '', // Bots will fill this, humans won't see it
  };

  onSubmit() {
    this.http.post('/contact', this.contactForm).subscribe({
      next: () => alert('Message sent!'),
      error: (err) => alert('Error: ' + err.error.message),
    });
  }
}
```

## Running Unit Tests

### Run all blog feature tests

```bash
npx nx test blogging --testPathPattern="(rss|spam-protection|post).spec.ts"
```

### Run specific test file

```bash
# RSS tests
npx nx test blogging --testPathPattern="rss.service.spec.ts"

# Spam protection tests
npx nx test blogging --testPathPattern="spam-protection.service.spec.ts"

# Post service tests (includes search)
npx nx test blogging --testPathPattern="post.service.spec.ts"
```

### Watch mode for development

```bash
npx nx test blogging --watch --testPathPattern="rss.service.spec.ts"
```

## Integration Testing Checklist

- [ ] RSS feed validates with W3C Feed Validator
- [ ] Search returns relevant results for various queries
- [ ] Search handles special characters properly
- [ ] SEO metadata generates correctly for all posts
- [ ] Sitemap includes all published posts
- [ ] Sitemap validates with XML sitemap validator
- [ ] Contact form blocks spam keywords
- [ ] Contact form detects honeypot submissions
- [ ] Contact form validates email addresses
- [ ] Contact form enforces message length limits
- [ ] Legitimate contact form submissions succeed
- [ ] All public endpoints work without authentication
- [ ] Protected endpoints require valid JWT

## Performance Testing

### Test RSS Feed Generation Performance

```bash
# Use Apache Bench
ab -n 100 -c 10 http://localhost:3000/post/rss/feed.xml

# Or use curl with timing
time curl "http://localhost:3000/post/rss/feed.xml" > /dev/null
```

### Test Search Performance

```bash
# Test various search terms
ab -n 100 -c 10 "http://localhost:3000/post/search?q=test"
```

### Expected Performance

- RSS feed generation: < 100ms for 100 posts
- Search queries: < 50ms with proper database indexes
- SEO metadata: < 10ms (simple data transformation)
- Sitemap generation: < 200ms for 1000 posts

## Lighthouse Testing

### Test blog post page with SEO metadata

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run Lighthouse
lighthouse https://your-blog-url/post/123 \
  --only-categories=seo,performance \
  --output=html \
  --output-path=./lighthouse-report.html
```

### Expected Scores

- **SEO:** 90+ (with proper metadata implementation)
- **Performance:** 80+ (depends on frontend optimization)

### SEO Checklist

- [ ] Meta description present and under 160 chars
- [ ] Title tag present and descriptive
- [ ] Open Graph tags present
- [ ] Twitter Card tags present
- [ ] Canonical URL specified
- [ ] Structured data (JSON-LD) for articles
- [ ] Mobile-friendly viewport
- [ ] Valid HTML

## Troubleshooting

### RSS Feed Issues

**Problem:** Feed validator shows errors

- Check that dates are in valid ISO 8601 format
- Ensure all required RSS 2.0 elements are present
- Verify XML is well-formed (no unescaped characters)

**Problem:** Feed shows HTML tags

- Confirm description uses stripped content
- Check that content:encoded wraps HTML in CDATA

### Search Issues

**Problem:** Search returns no results

- Verify posts exist with isDraft = false
- Check database supports ILIKE operator (PostgreSQL)
- Ensure search term is not empty

**Problem:** Search is slow

- Add database index on title and content columns:
  ```sql
  CREATE INDEX idx_post_title ON post(title);
  CREATE INDEX idx_post_content ON post USING gin(to_tsvector('english', content));
  ```

### Spam Protection Issues

**Problem:** Legitimate submissions blocked

- Review spam keyword list
- Adjust pattern thresholds
- Check for false positives in email validation

**Problem:** Spam getting through

- Add more spam keywords
- Implement rate limiting
- Consider adding CAPTCHA

## Next Steps

1. **Deploy to staging environment** and test all endpoints
2. **Run Lighthouse audits** on actual blog pages
3. **Submit sitemap** to search engines
4. **Monitor RSS feed** subscribers
5. **Analyze search queries** for content ideas
6. **Review spam logs** to improve detection

## Support & Resources

- RSS 2.0 Specification: https://www.rssboard.org/rss-specification
- Open Graph Protocol: https://ogp.me/
- Twitter Cards: https://developer.twitter.com/en/docs/twitter-for-websites/cards
- Sitemap Protocol: https://www.sitemaps.org/protocol.html
- W3C Feed Validator: https://validator.w3.org/feed/
