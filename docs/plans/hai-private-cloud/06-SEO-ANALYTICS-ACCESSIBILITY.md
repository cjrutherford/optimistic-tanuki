# SEO, Analytics, Accessibility, and Performance

## SEO

Target pages should have unique titles, descriptions, canonical URLs, and OpenGraph metadata.

Suggested titles:

- `/private-cloud`: `Private Cloud Systems | Hopeful Aspirations Industries`
- `/private-cloud/home`: `Private Cloud for Home, Photos & Media | HAI`
- `/private-cloud/organizations`: `Private Cloud for Small Businesses, Nonprofits & Faith Groups | HAI`
- `/private-cloud/open-source-stack`: `Open-Source Private Cloud Stack | HAI`

## Analytics

Track:

- private-cloud landing visits
- CTA clicks
- assessment starts
- assessment submissions
- home vs organization interest
- OSS stack visits
- phone clicks
- email clicks
- campaign/UTM parameters

Prefer privacy-friendly analytics consistent with company positioning.

## Print campaign parameters

Final print destinations (S019). The single source is
`scripts/hai-print-campaigns.txt`; print QR codes prefix
`https://hopefulaspirationsindustries.com`.

```text
/private-cloud?utm_source=print&utm_medium=flyer&utm_campaign=private_cloud
/private-cloud?utm_source=print&utm_medium=brochure&utm_campaign=private_cloud
/private-cloud/open-source-stack?utm_source=print&utm_medium=brochure&utm_campaign=oss_stack
```

## Accessibility

- WCAG AA text contrast
- keyboard navigation
- visible focus states
- semantic headings
- meaningful alt text
- labeled form inputs
- reduced-motion support
- no essential information encoded only by color

## Responsive targets

- 375px
- 430px
- 768px
- 1024px
- 1440px
- 1920px

## Performance targets

Aim for:

- LCP < 2.5s
- CLS < 0.1
- INP < 200ms

Use AVIF/WebP where practical, lazy-load below-fold images, and avoid shipping print-resolution PNGs directly to the live site.
