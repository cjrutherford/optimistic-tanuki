import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  BusinessApiService,
  BusinessSiteConfigStore,
  LandingSection,
  LandingSectionMediaItem,
  LandingSectionMotionConfig,
  BusinessStoreProduct,
  injectSiteSlugSignal,
} from '@optimistic-tanuki/business-data-access';
import {
  AuroraRibbonComponent,
  GlassFogComponent,
  ParallaxGridWarpComponent,
  ParticleVeilComponent,
  PulseRingsComponent,
  ShimmerBeamComponent,
  SignalMeshComponent,
  TopographicDriftComponent,
} from '@optimistic-tanuki/motion-ui';
// Deep import, not the barrel: the barrel pins every motion component into
// one chunk, so pulling murmuration through it would drag three.js in with
// the eagerly-used effects and defeat the @defer below.
import { MurmurationSceneComponent } from '@optimistic-tanuki/motion-ui/murmuration-scene';
import { ContactFormComponent } from '@optimistic-tanuki/blogging-ui';
import { ProductCardComponent } from '@optimistic-tanuki/store-ui';
import { BusinessRichContentRendererComponent } from './business-rich-content-renderer.component';

@Component({
  selector: 'business-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ParticleVeilComponent,
    ParallaxGridWarpComponent,
    AuroraRibbonComponent,
    GlassFogComponent,
    MurmurationSceneComponent,
    PulseRingsComponent,
    SignalMeshComponent,
    TopographicDriftComponent,
    ShimmerBeamComponent,
    ContactFormComponent,
    ProductCardComponent,
    BusinessRichContentRendererComponent,
  ],
  template: `
    <ng-template #renderMotion let-section>
      @if (motion(section); as motionConfig) { @switch (motionConfig.kind) {
      @case ('particle-veil') {
      <otui-particle-veil
        [height]="motionHeight(motionConfig)"
        [density]="motionConfig.density ?? 28"
        [speed]="motionConfig.speed ?? 1.4"
        [intensity]="motionConfig.intensity ?? 0.65"
        [reducedMotion]="motionConfig.reducedMotion ?? false"
      ></otui-particle-veil>
      } @case ('parallax-grid-warp') {
      <otui-parallax-grid-warp
        [height]="motionHeight(motionConfig)"
        [density]="motionConfig.density ?? 8"
        [speed]="motionConfig.speed ?? 1.4"
        [intensity]="motionConfig.intensity ?? 0.7"
        [reducedMotion]="motionConfig.reducedMotion ?? false"
      ></otui-parallax-grid-warp>
      } @case ('aurora-ribbon') {
      <otui-aurora-ribbon
        [height]="motionHeight(motionConfig)"
        [density]="motionConfig.density ?? 5"
        [speed]="motionConfig.speed ?? 1.4"
        [intensity]="motionConfig.intensity ?? 0.72"
        [reducedMotion]="motionConfig.reducedMotion ?? false"
      ></otui-aurora-ribbon>
      } @case ('glass-fog') {
      <otui-glass-fog
        [height]="motionHeight(motionConfig)"
        [density]="motionConfig.density ?? 6"
        [speed]="motionConfig.speed ?? 1.4"
        [intensity]="motionConfig.intensity ?? 0.66"
        [reducedMotion]="motionConfig.reducedMotion ?? false"
      ></otui-glass-fog>
      } @case ('pulse-rings') {
      <otui-pulse-rings
        [height]="motionHeight(motionConfig)"
        [ringCount]="motionConfig.ringCount ?? 6"
        [speed]="motionConfig.speed ?? 1.4"
        [intensity]="motionConfig.intensity ?? 0.7"
        [reducedMotion]="motionConfig.reducedMotion ?? false"
      ></otui-pulse-rings>
      } @case ('signal-mesh') {
      <otui-signal-mesh
        [height]="motionHeight(motionConfig)"
        [density]="motionConfig.density ?? 6"
        [speed]="motionConfig.speed ?? 1.4"
        [intensity]="motionConfig.intensity ?? 0.68"
        [reducedMotion]="motionConfig.reducedMotion ?? false"
      ></otui-signal-mesh>
      } @case ('topographic-drift') {
      <otui-topographic-drift
        [height]="motionHeight(motionConfig)"
        [density]="motionConfig.density ?? 8"
        [speed]="motionConfig.speed ?? 1.4"
        [intensity]="motionConfig.intensity ?? 0.64"
        [reducedMotion]="motionConfig.reducedMotion ?? false"
      ></otui-topographic-drift>
      } @case ('shimmer-beam') {
      <otui-shimmer-beam
        [height]="motionHeight(motionConfig)"
        [speed]="motionConfig.speed ?? 1.4"
        [intensity]="motionConfig.intensity ?? 0.65"
        [reducedMotion]="motionConfig.reducedMotion ?? false"
        [direction]="motionConfig.direction ?? 'diagonal'"
      ></otui-shimmer-beam>
      } @case ('murmuration-scene') {
      <!--
        Deferred on purpose: this is the only motion kind backed by
        three.js. Without @defer the whole WebGL runtime would be bundled
        into the landing-page chunk that every visitor of every tenant
        downloads, to serve the few sites that actually pick it. The
        @defer block keeps it in its own chunk, fetched only when a
        section really renders this kind.
      -->
      @defer (on immediate) {
      <otui-murmuration-scene
        [height]="motionHeight(motionConfig)"
        [count]="motionConfig.density ?? 72"
        [speed]="motionConfig.speed ?? 0.5"
        [reducedMotion]="motionConfig.reducedMotion ?? false"
      ></otui-murmuration-scene>
      } } } }
    </ng-template>

    <ng-template #renderSection let-section>
      @switch (section.type) { @case ('hero') {
      <div
        class="layout-item section-shell"
        [class.has-motion]="!!motion(section)"
        [class.preview-section-selected]="
          embeddedPreview && selectedSectionId === section.id
        "
        [attr.data-section-id]="section.id"
        [attr.data-motion-kind]="section.motion?.kind ?? 'none'"
        (click)="onPreviewSectionClick($event, section.id)"
      >
        <section class="hero" [class.has-motion]="!!motion(section)" id="hero">
          <div class="hero-motion">
            <ng-container
              [ngTemplateOutlet]="renderMotion"
              [ngTemplateOutletContext]="{ $implicit: section }"
            ></ng-container>
          </div>
          <div class="hero-content">
            <div class="copy hero-panel entrance" style="animation-delay: 0.1s">
              <p class="eyebrow">{{ site().brand.businessName }}</p>
              @if (section.richContent?.content) {
              <business-rich-content-renderer
                [content]="section.richContent ?? null"
              ></business-rich-content-renderer>
              } @else {
              <h1>{{ site().brand.tagline }}</h1>
              <p class="lede">{{ site().brand.intro }}</p>
              <p class="body">{{ site().brand.longBio }}</p>
              }
              <div class="actions">
                @if (section.ctaHref?.startsWith('#')) {
                <a class="cta-primary" [href]="section.ctaHref">{{
                  section.ctaLabel || 'Explore now'
                }}</a>
                } @else if (site().features.booking.enabled && siteSlug()) {
                <a class="cta-primary" [routerLink]="bookingRoute()">{{
                  site().contact.consultationLabel
                }}</a>
                } @if (site().features.clientPortal.enabled) {
                <a class="cta-secondary" [routerLink]="clientPortalRoute()"
                  >Client Portal</a
                >
                }
              </div>
            </div>
          </div>
        </section>
      </div>
      } @case ('about') {
      <div
        class="layout-item section-shell"
        [class.has-motion]="!!motion(section)"
        [class.preview-section-selected]="
          embeddedPreview && selectedSectionId === section.id
        "
        [attr.data-section-id]="section.id"
        [attr.data-motion-kind]="section.motion?.kind ?? 'none'"
        (click)="onPreviewSectionClick($event, section.id)"
      >
        @if (motion(section)) {
        <div class="section-motion">
          <ng-container
            [ngTemplateOutlet]="renderMotion"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
        </div>
        }
        <section
          class="about-section entrance section-surface"
          style="animation-delay: 0.18s"
        >
          <div class="section-head">
            <p class="eyebrow">{{ section.title }}</p>
            <h2>{{ site().brand.businessName }}</h2>
          </div>
          @if (section.richContent?.content) {
          <business-rich-content-renderer
            [content]="section.richContent ?? null"
          ></business-rich-content-renderer>
          } @else {
          <p class="body">{{ site().brand.longBio }}</p>
          }
          <div class="about-owner-block">
            <div class="profile-header">
              <span class="avatar-mark">{{ site().brand.monogram }}</span>
              <div>
                <p class="eyebrow">Owner</p>
                <h3>{{ ownerName() }}</h3>
              </div>
            </div>
            @if (site().brand.credentials.length) {
            <ul class="credential-list">
              @for (credential of site().brand.credentials; track credential) {
              <li>{{ credential }}</li>
              }
            </ul>
            } @if (site().brand.specializations.length) {
            <div class="specialties">
              @for (item of site().brand.specializations; track item) {
              <span data-theme-aware="true">{{ item }}</span>
              }
            </div>
            }
          </div>
        </section>
      </div>
      } @case ('services') {
      <div
        class="layout-item section-shell"
        [class.has-motion]="!!motion(section)"
        [class.preview-section-selected]="
          embeddedPreview && selectedSectionId === section.id
        "
        [attr.data-section-id]="section.id"
        [attr.data-motion-kind]="section.motion?.kind ?? 'none'"
        (click)="onPreviewSectionClick($event, section.id)"
      >
        @if (motion(section)) {
        <div class="section-motion">
          <ng-container
            [ngTemplateOutlet]="renderMotion"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
        </div>
        }
        <section
          class="entrance section-surface"
          id="results"
          style="animation-delay: 0.2s"
        >
          <div class="section-head">
            <p class="eyebrow">{{ section.title }}</p>
            <h2>
              Choose a starting point, then build the right engagement from
              there.
            </h2>
          </div>
          @if (section.richContent?.content) {
          <business-rich-content-renderer
            [content]="section.richContent ?? null"
          ></business-rich-content-renderer>
          }
          <div class="offer-stack">
            @for (offer of offers(); track offer.id; let i = $index) {
            <div
              class="offer entrance"
              [style.animation-delay]="0.25 + i * 0.06 + 's'"
            >
              <div class="offer-header">
                <span class="offer-badge">{{ offer.serviceType }}</span>
                <h3>{{ offer.label }}</h3>
              </div>
              <p>{{ offer.description }}</p>
              <div class="offer-rate">
                <span>From</span>
                <strong
                  >{{ '$' + offer.startingRate }}<small>/hr</small></strong
                >
              </div>
            </div>
            } @empty {
            <div class="offer entrance" style="animation-delay: 0.25s">
              <h3>Consultation-led services</h3>
              <p>
                Availability-backed service options will appear here as the
                schedule is published.
              </p>
            </div>
            }
          </div>
        </section>
      </div>
      } @case ('store') {
      <div
        class="layout-item section-shell"
        [class.has-motion]="!!motion(section)"
        [class.preview-section-selected]="
          embeddedPreview && selectedSectionId === section.id
        "
        [attr.data-section-id]="section.id"
        [attr.data-motion-kind]="section.motion?.kind ?? 'none'"
        (click)="onPreviewSectionClick($event, section.id)"
      >
        @if (motion(section)) {
        <div class="section-motion">
          <ng-container
            [ngTemplateOutlet]="renderMotion"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
        </div>
        }
        <section
          class="store-section entrance section-surface"
          id="storefront"
          style="animation-delay: 0.22s"
        >
          <div class="section-head">
            <p class="eyebrow">{{ section.title }}</p>
            <h2>{{ section.title }}</h2>
          </div>
          @if (section.body) {
          <p class="body">{{ section.body }}</p>
          }
          <div class="store-product-grid">
            @for (product of storefrontProducts(); track product.id) {
            <store-product-card
              [product]="storefrontProductCard(product)"
              [showAddToCart]="false"
              [viewProductHref]="productViewHref(product)"
            ></store-product-card>
            } @empty {
            <div class="offer">
              <h3>No storefront inventory is live yet.</h3>
              <p>
                Activate physical or digital products in the store workspace.
              </p>
            </div>
            }
          </div>
          <div class="actions">
            @if (site().features.booking.enabled && bookingRoute()) {
            <a class="cta-secondary" [routerLink]="bookingRoute()">{{
              section.ctaLabel || site().contact.consultationLabel
            }}</a>
            }
          </div>
        </section>
      </div>
      } @case ('testimonials') {
      <div
        class="layout-item section-shell"
        [class.has-motion]="!!motion(section)"
        [class.preview-section-selected]="
          embeddedPreview && selectedSectionId === section.id
        "
        [attr.data-section-id]="section.id"
        [attr.data-motion-kind]="section.motion?.kind ?? 'none'"
        (click)="onPreviewSectionClick($event, section.id)"
      >
        @if (motion(section)) {
        <div class="section-motion">
          <ng-container
            [ngTemplateOutlet]="renderMotion"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
        </div>
        }
        <section
          class="entrance section-surface"
          style="animation-delay: 0.15s"
        >
          <div class="section-head">
            <p class="eyebrow">{{ section.title }}</p>
            <h2>Services that fit real schedules and still move the needle.</h2>
          </div>
          @if (section.richContent?.content) {
          <business-rich-content-renderer
            [content]="section.richContent ?? null"
          ></business-rich-content-renderer>
          }
          <div class="testimonial-stack">
            @for (testimonial of site().testimonials; track
            testimonial.clientName; let i = $index) {
            <blockquote
              class="testimonial entrance"
              [style.animation-delay]="0.2 + i * 0.08 + 's'"
            >
              <p>"{{ testimonial.quote }}"</p>
              <footer>
                <strong>{{ testimonial.clientName }}</strong>
                <span>{{ testimonial.clientDetail }}</span>
              </footer>
            </blockquote>
            }
          </div>
        </section>
      </div>
      } @case ('booking') {
      <div
        class="layout-item section-shell"
        [class.has-motion]="!!motion(section)"
        [class.preview-section-selected]="
          embeddedPreview && selectedSectionId === section.id
        "
        [attr.data-section-id]="section.id"
        [attr.data-motion-kind]="section.motion?.kind ?? 'none'"
        (click)="onPreviewSectionClick($event, section.id)"
      >
        @if (motion(section)) {
        <div class="section-motion">
          <ng-container
            [ngTemplateOutlet]="renderMotion"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
        </div>
        }
        <section
          class="contact entrance section-surface"
          style="animation-delay: 0.24s"
        >
          <div class="section-head">
            <p class="eyebrow">{{ section.title }}</p>
            <h2>Book the right starting point when you are ready.</h2>
          </div>
          @if (section.richContent?.content) {
          <business-rich-content-renderer
            [content]="section.richContent ?? null"
          ></business-rich-content-renderer>
          }
          <div class="actions">
            @if (siteSlug()) {
            <a
              class="cta-primary"
              [routerLink]="['/sites', siteSlug(), 'book']"
              >{{ site().contact.consultationLabel }}</a
            >
            }
          </div>
        </section>
      </div>
      } @case ('contact') {
      <div
        class="layout-item section-shell"
        [class.has-motion]="!!motion(section)"
        [class.preview-section-selected]="
          embeddedPreview && selectedSectionId === section.id
        "
        [attr.data-section-id]="section.id"
        [attr.data-motion-kind]="section.motion?.kind ?? 'none'"
        (click)="onPreviewSectionClick($event, section.id)"
      >
        @if (motion(section)) {
        <div class="section-motion">
          <ng-container
            [ngTemplateOutlet]="renderMotion"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
        </div>
        }
        <section
          class="contact entrance section-surface"
          id="contact"
          style="animation-delay: 0.3s"
        >
          <div class="section-head">
            <p class="eyebrow">{{ section.title }}</p>
            <h2>
              Reach out when you are ready to talk goals, schedule, and fit.
            </h2>
          </div>
          @if (section.richContent?.content) {
          <business-rich-content-renderer
            [content]="section.richContent ?? null"
          ></business-rich-content-renderer>
          }
          <div
            class="contact-grid"
            [class.contact-grid-with-image]="!!section.image?.src"
          >
            <div class="contact-column contact-column-primary">
              @if (section.image?.src) {
              <figure
                class="media-figure contact-media"
                [class]="'aspect-' + (section.image?.aspect ?? 'portrait')"
              >
                <img
                  [src]="section.image?.src"
                  [alt]="section.image?.alt || section.title"
                  [style.object-fit]="section.image?.fit ?? 'cover'"
                  [style.object-position]="mediaObjectPosition(section.image)"
                />
                @if (section.image?.caption) {
                <figcaption>{{ section.image?.caption }}</figcaption>
                }
              </figure>
              }
              <div class="contact-info-card">
                <div class="contact-info">
                  <div class="contact-row">
                    <span class="contact-label">Email</span>
                    <strong>{{ site().contact.email }}</strong>
                  </div>
                  <div class="contact-row">
                    <span class="contact-label">Phone</span>
                    <span>{{ site().contact.phone }}</span>
                  </div>
                  <div class="contact-row">
                    <span class="contact-label">Location</span>
                    <span>{{ site().contact.location }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="contact-column contact-form-panel">
              <lib-contact-form
                [title]="'Contact ' + site().brand.businessName"
                [buttonText]="
                  contactSubmitting
                    ? 'Sending...'
                    : site().features.booking.enabled
                    ? site().contact.consultationLabel
                    : 'Send message'
                "
                [subjects]="contactSubjects"
                (formSubmit)="submitContactForm($event)"
              ></lib-contact-form>
              @if (contactStatus) {
              <p class="contact-feedback">{{ contactStatus }}</p>
              }
            </div>
          </div>
        </section>
      </div>
      } @case ('custom') {
      <div
        class="layout-item section-shell"
        [class.has-motion]="!!motion(section)"
        [class.preview-section-selected]="
          embeddedPreview && selectedSectionId === section.id
        "
        [attr.data-section-id]="section.id"
        [attr.data-motion-kind]="section.motion?.kind ?? 'none'"
        (click)="onPreviewSectionClick($event, section.id)"
      >
        @if (motion(section)) {
        <div class="section-motion">
          <ng-container
            [ngTemplateOutlet]="renderMotion"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
        </div>
        }
        <section
          class="custom-section entrance section-surface"
          [attr.data-section-id]="section.id"
          style="animation-delay: 0.22s"
        >
          <div class="section-head">
            <p class="eyebrow">{{ section.title }}</p>
            <h2>{{ section.title }}</h2>
          </div>
          @if (section.richContent?.content) {
          <business-rich-content-renderer
            [content]="section.richContent ?? null"
          ></business-rich-content-renderer>
          } @else if (section.body) {
          <p class="body">{{ section.body }}</p>
          } @if (section.ctaLabel && sectionCtaHref(section)) {
          <div class="actions">
            <a class="cta-primary" [href]="sectionCtaHref(section)">{{
              section.ctaLabel
            }}</a>
          </div>
          }
        </section>
      </div>
      } @case ('image') {
      <div
        class="layout-item section-shell"
        [class.has-motion]="!!motion(section)"
        [class.preview-section-selected]="
          embeddedPreview && selectedSectionId === section.id
        "
        [attr.data-section-id]="section.id"
        [attr.data-motion-kind]="section.motion?.kind ?? 'none'"
        (click)="onPreviewSectionClick($event, section.id)"
      >
        @if (motion(section)) {
        <div class="section-motion">
          <ng-container
            [ngTemplateOutlet]="renderMotion"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
        </div>
        }
        <section
          class="image-section entrance section-surface"
          style="animation-delay: 0.22s"
        >
          <div class="section-head">
            <p class="eyebrow">{{ section.title }}</p>
            <h2>{{ section.title }}</h2>
          </div>
          @if (section.image?.src) {
          <figure
            class="media-figure"
            [class]="'aspect-' + (section.image?.aspect ?? 'landscape')"
          >
            <img
              [src]="section.image?.src"
              [alt]="section.image?.alt || section.title"
              [style.object-fit]="section.image?.fit ?? 'cover'"
              [style.object-position]="mediaObjectPosition(section.image)"
            />
            @if (section.image?.caption) {
            <figcaption>{{ section.image?.caption }}</figcaption>
            }
          </figure>
          }
        </section>
      </div>
      } @case ('gallery') {
      <div
        class="layout-item section-shell"
        [class.has-motion]="!!motion(section)"
        [class.preview-section-selected]="
          embeddedPreview && selectedSectionId === section.id
        "
        [attr.data-section-id]="section.id"
        [attr.data-motion-kind]="section.motion?.kind ?? 'none'"
        (click)="onPreviewSectionClick($event, section.id)"
      >
        @if (motion(section)) {
        <div class="section-motion">
          <ng-container
            [ngTemplateOutlet]="renderMotion"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
        </div>
        }
        <section
          class="gallery-section entrance section-surface"
          style="animation-delay: 0.22s"
        >
          <div class="section-head">
            <p class="eyebrow">{{ section.title }}</p>
            <h2>{{ section.title }}</h2>
          </div>
          <div
            class="gallery-grid"
            [class.gallery-masonry]="section.gallery?.style === 'masonry'"
            [style.grid-template-columns]="
              'repeat(' + (section.gallery?.columns ?? 3) + ', minmax(0, 1fr))'
            "
          >
            @for (item of section.gallery?.items ?? []; track item.src + '-' +
            $index) { @if (item.src) {
            <figure
              class="gallery-item"
              [class]="'aspect-' + (item.aspect ?? 'square')"
            >
              <img
                [src]="item.src"
                [alt]="item.alt || section.title"
                [style.object-fit]="item.fit ?? 'cover'"
                [style.object-position]="mediaObjectPosition(item)"
              />
              @if (item.caption) {
              <figcaption>{{ item.caption }}</figcaption>
              }
            </figure>
            } }
          </div>
        </section>
      </div>
      } }
    </ng-template>

    <div
      class="landing-page-root"
      [class.embedded-preview]="embeddedPreview"
      [attr.data-embedded-preview-root]="embeddedPreview ? '' : null"
    >
      @if (activeLayout() === 'single-column') {
      <div class="landing-shell layout-single-column">
        <div class="layout-column" data-layout-zone="single-column:main">
          @for (section of visibleSections(); track section.id) {
          <ng-container
            [ngTemplateOutlet]="renderSection"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
          }
        </div>
      </div>
      } @else if (activeLayout() === 'split') {
      <div class="landing-shell layout-split">
        <div class="layout-column" data-layout-zone="split:primary">
          @for (section of sectionsForZone('split', 'primary'); track
          section.id) {
          <ng-container
            [ngTemplateOutlet]="renderSection"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
          }
        </div>
        <div class="layout-column" data-layout-zone="split:secondary">
          @for (section of sectionsForZone('split', 'secondary'); track
          section.id) {
          <ng-container
            [ngTemplateOutlet]="renderSection"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
          }
        </div>
      </div>
      } @else {
      <div class="landing-shell layout-grid">
        @for (zone of gridZones; track zone) {
        <div
          class="layout-column"
          [class]="'grid-zone-' + zone"
          [attr.data-layout-zone]="'grid:' + zone"
        >
          @for (section of sectionsForZone('grid', zone); track section.id) {
          <ng-container
            [ngTemplateOutlet]="renderSection"
            [ngTemplateOutletContext]="{ $implicit: section }"
          ></ng-container>
          }
        </div>
        }
      </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: grid;
        gap: 1.5rem;
      }

      .landing-page-root {
        display: grid;
        gap: 1.5rem;
      }

      .landing-page-root.embedded-preview {
        gap: 1.25rem;
      }

      .landing-page-root.embedded-preview .section-shell {
        cursor: pointer;
        border-radius: calc(var(--personality-card-radius, 1.5rem) + 0.3rem);
      }

      .landing-page-root.embedded-preview .section-shell::after {
        content: '';
        position: absolute;
        inset: -0.35rem;
        border-radius: calc(var(--personality-card-radius, 1.5rem) + 0.35rem);
        border: 2px solid transparent;
        background: transparent;
        pointer-events: none;
        transition: border-color 0.18s ease, background-color 0.18s ease;
      }

      .landing-page-root.embedded-preview .section-shell:hover::after,
      .landing-page-root.embedded-preview
        .section-shell.preview-section-selected::after {
        border-color: color-mix(
          in srgb,
          var(--primary) 72%,
          var(--surface, var(--background))
        );
        background: color-mix(in srgb, var(--primary) 8%, transparent);
      }

      .landing-shell {
        display: grid;
        gap: 1.5rem;
      }

      .layout-column {
        display: grid;
        gap: 1.5rem;
        align-content: start;
      }

      .section-shell {
        position: relative;
        isolation: isolate;
      }

      .section-motion {
        position: absolute;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        border-radius: var(--personality-card-radius, 1.5rem);
        pointer-events: none;
      }

      .landing-page-root.embedded-preview .section-motion,
      .landing-page-root.embedded-preview .hero-motion {
        opacity: 0.94;
        filter: saturate(1.08);
      }

      .section-motion > *,
      .hero-motion > * {
        display: block;
        width: 100%;
        height: 100%;
      }

      .section-motion ::ng-deep .particle-veil,
      .section-motion ::ng-deep .parallax-grid-warp,
      .section-motion ::ng-deep .aurora-ribbon,
      .section-motion ::ng-deep .glass-fog,
      .section-motion ::ng-deep .pulse-rings,
      .section-motion ::ng-deep .signal-mesh,
      .section-motion ::ng-deep .topographic-drift,
      .section-motion ::ng-deep .shimmer-beam {
        border: none;
        border-radius: 0;
        box-shadow: none;
      }

      .section-surface {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 1rem;
        padding: var(--personality-card-padding, 1.35rem);
        border-radius: var(--personality-card-radius, 1.5rem);
        border: var(--personality-border-width, 1px) solid var(--border);
        box-shadow: var(
          --personality-card-shadow,
          0 18px 44px rgba(15, 23, 42, 0.06)
        );
        background: color-mix(
          in srgb,
          var(--surface, var(--background)) 96%,
          transparent 4%
        );
      }

      .landing-page-root.embedded-preview .section-surface {
        background: color-mix(
          in srgb,
          var(--surface, var(--background)) 86%,
          transparent 14%
        );
      }

      .section-shell.has-motion .section-surface,
      .hero.has-motion .hero-panel {
        background: transparent;
        backdrop-filter: none;
      }

      .layout-split {
        grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr);
        align-items: start;
      }

      .layout-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: start;
      }

      .grid-zone-hero-wide {
        grid-column: 1 / -1;
      }

      .layout-single-column {
        grid-template-columns: 1fr;
      }

      @keyframes entrance-up {
        from {
          opacity: 0;
          transform: translateY(28px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .entrance {
        opacity: 0;
        animation: entrance-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }

      .hero {
        position: relative;
        border-radius: var(--personality-card-radius, 1.5rem);
        overflow: hidden;
        border: var(--personality-border-width, 1px) solid var(--border);
        box-shadow: var(
          --personality-card-shadow,
          0 18px 44px rgba(15, 23, 42, 0.06)
        );
      }

      .hero-motion {
        position: absolute;
        inset: 0;
        z-index: 0;
      }

      .hero-motion ::ng-deep .particle-veil {
        border: none;
        border-radius: 0;
        box-shadow: none;
      }

      .hero-content {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 1.25rem;
        padding: 2rem;
      }

      .copy {
        display: grid;
        gap: 1rem;
        align-content: start;
      }

      .hero-panel {
        position: relative;
        z-index: 1;
        padding: var(--personality-card-padding, 1.35rem);
        border-radius: var(--personality-card-radius, 1.5rem);
        border: var(--personality-border-width, 1px) solid var(--border);
        box-shadow: var(
          --personality-card-shadow,
          0 18px 44px rgba(15, 23, 42, 0.06)
        );
      }

      .eyebrow,
      .type,
      .offer-badge {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--primary);
      }

      h1,
      h2,
      h3 {
        margin: 0;
        font-family: var(
          --font-heading,
          'Source Sans Pro',
          system-ui,
          sans-serif
        );
        font-weight: 700;
        color: var(--foreground);
      }

      h1 {
        font-size: clamp(2.4rem, 5.5vw, 4.2rem);
        line-height: 0.98;
        max-width: 14ch;
      }

      h2 {
        font-size: clamp(1.3rem, 2.4vw, 1.9rem);
        line-height: 1.15;
      }

      h3 {
        font-size: 1.1rem;
        line-height: 1.25;
      }

      .lede {
        font-size: 1.15rem;
        line-height: 1.55;
        color: color-mix(in srgb, var(--foreground) 82%, transparent);
      }

      .body,
      .offer p,
      .testimonial p,
      .contact p {
        color: color-mix(in srgb, var(--foreground) 72%, transparent);
        line-height: 1.6;
      }

      .actions {
        display: flex;
        gap: 0.8rem;
        flex-wrap: wrap;
        margin-top: 0.5rem;
      }

      .cta-primary,
      .cta-secondary {
        text-decoration: none;
        padding: var(--personality-button-padding, 0.9rem 1.25rem);
        border-radius: var(--personality-button-radius, 999px);
        font-weight: 700;
        font-size: 0.92rem;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
          box-shadow 0.2s ease, background 0.2s ease;
        will-change: transform;
      }

      .cta-primary:hover,
      .cta-secondary:hover {
        transform: translateY(-2px);
      }

      .cta-primary {
        background: var(--primary);
        color: var(--primary-foreground);
        box-shadow: 0 6px 18px
          color-mix(in srgb, var(--primary) 24%, transparent);
      }

      .cta-primary:hover {
        box-shadow: 0 10px 28px
          color-mix(in srgb, var(--primary) 32%, transparent);
        background: color-mix(in srgb, var(--primary) 88%, var(--foreground));
      }

      .cta-secondary {
        border: var(--personality-border-width, 1px) solid var(--border);
        background: color-mix(in srgb, var(--background) 80%, transparent);
        color: var(--foreground);
      }

      .cta-secondary:hover {
        background: var(--surface);
        border-color: var(--primary);
      }

      .profile-header {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .avatar-mark {
        width: 3.2rem;
        height: 3.2rem;
        border-radius: var(--personality-border-radius, 1rem);
        display: grid;
        place-items: center;
        font-weight: 800;
        font-size: 1.1rem;
        color: var(--primary-foreground, white);
        background: var(--primary);
        border: var(--personality-border-width, 1px) solid
          color-mix(in srgb, var(--primary) 70%, var(--foreground));
      }

      .credential-list {
        margin: 0;
        padding-left: 1.1rem;
        color: color-mix(in srgb, var(--foreground) 72%, transparent);
        font-size: 0.92rem;
        line-height: 1.7;
      }

      .about-section {
        display: grid;
        gap: 1.5rem;
      }

      .about-owner-block {
        display: grid;
        gap: 1rem;
      }

      .specialties {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .specialties span {
        padding: 0.4rem 0.85rem;
        border-radius: var(--personality-button-radius, 999px);
        background: color-mix(
          in srgb,
          var(--surface, var(--background)) 82%,
          var(--primary) 18%
        );
        color: color-mix(in srgb, var(--foreground) 88%, transparent);
        font-size: 0.85rem;
        font-weight: 600;
        border: var(--personality-border-width, 1px) solid var(--border);
        box-shadow: inset 0 1px 0
          color-mix(in srgb, var(--primary) 10%, transparent);
      }

      .proof-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .section-head {
        display: grid;
        gap: 0.6rem;
      }

      .testimonial-stack {
        display: grid;
        gap: 0.85rem;
      }

      .testimonial {
        margin: 0;
        border: var(--personality-border-width, 1px) solid var(--border);
        border-radius: var(--personality-card-radius, 1rem);
        padding: var(--personality-card-padding, 1.15rem);
        box-shadow: var(--personality-card-shadow, none);
        background: var(--background);
        transition: transform 0.25s ease, box-shadow 0.25s ease;
      }

      .testimonial:hover {
        transform: translateY(-3px);
        box-shadow: 0 12px 32px
          color-mix(in srgb, var(--primary) 8%, rgba(0, 0, 0, 0.06));
      }

      .testimonial p {
        font-style: italic;
        font-size: 0.95rem;
        line-height: 1.6;
        margin-bottom: 0.75rem;
      }

      .testimonial footer {
        display: grid;
        gap: 0.15rem;
      }

      .testimonial footer span {
        font-size: 0.82rem;
        color: color-mix(in srgb, var(--foreground) 58%, transparent);
      }

      .offer-stack {
        display: grid;
        gap: 0.85rem;
      }

      .offer {
        display: grid;
        gap: 0.6rem;
        padding: var(--personality-card-padding, 1.15rem);
        border: var(--personality-border-width, 1px) solid var(--border);
        border-radius: var(--personality-card-radius, 1rem);
        background: var(--background);
        transition: transform 0.25s ease, box-shadow 0.25s ease,
          border-color 0.25s ease;
      }

      .offer:hover {
        transform: translateY(-3px);
        border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
        box-shadow: 0 12px 32px
          color-mix(in srgb, var(--primary) 8%, rgba(0, 0, 0, 0.06));
      }

      .offer-header {
        display: grid;
        gap: 0.35rem;
      }

      .offer-badge {
        width: fit-content;
        padding: 0.25rem 0.65rem;
        border-radius: var(--personality-button-radius, 999px);
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        border: var(--personality-border-width, 1px) solid
          color-mix(in srgb, var(--primary) 24%, transparent);
      }

      .offer-rate {
        display: flex;
        align-items: baseline;
        gap: 0.4rem;
        margin-top: 0.25rem;
      }

      .offer-rate span {
        font-size: 0.85rem;
        color: color-mix(in srgb, var(--foreground) 62%, transparent);
      }

      .offer-rate strong {
        font-size: 1.25rem;
        color: var(--primary);
      }

      .offer-rate small {
        font-size: 0.8rem;
        color: color-mix(in srgb, var(--foreground) 58%, transparent);
        font-weight: 500;
      }

      .store-product-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }

      .contact {
        display: grid;
        gap: 1.5rem;
      }

      .custom-section {
        display: grid;
        gap: 1rem;
      }

      .custom-section business-rich-content-renderer {
        display: block;
      }

      .custom-section
        business-rich-content-renderer
        ::ng-deep
        > .rich-content-renderer {
        display: grid;
        gap: 1rem;
        color: color-mix(in srgb, var(--foreground) 88%, transparent);
        line-height: 1.7;
      }

      .custom-section business-rich-content-renderer ::ng-deep p,
      .custom-section business-rich-content-renderer ::ng-deep ul,
      .custom-section business-rich-content-renderer ::ng-deep ol {
        margin: 0;
      }

      .custom-section business-rich-content-renderer ::ng-deep ul,
      .custom-section business-rich-content-renderer ::ng-deep ol {
        padding-left: 1.25rem;
      }

      .image-section,
      .gallery-section {
        display: grid;
        gap: 1rem;
      }

      .media-figure,
      .gallery-item {
        margin: 0;
        overflow: hidden;
        border-radius: var(--personality-card-radius, 1rem);
        border: var(--personality-border-width, 1px) solid var(--border);
        background: color-mix(
          in srgb,
          var(--surface, var(--background)) 84%,
          var(--background)
        );
      }

      .media-figure img,
      .gallery-item img {
        width: 100%;
        height: 100%;
        display: block;
      }

      .media-figure figcaption,
      .gallery-item figcaption {
        padding: 0.8rem 0.95rem;
        color: color-mix(in srgb, var(--foreground) 68%, transparent);
        font-size: 0.86rem;
        line-height: 1.5;
      }

      .gallery-grid {
        display: grid;
        gap: 0.85rem;
      }

      .gallery-grid.gallery-masonry .gallery-item:nth-child(3n + 2) {
        transform: translateY(0.75rem);
      }

      .aspect-landscape {
        aspect-ratio: 16 / 9;
      }

      .aspect-square {
        aspect-ratio: 1 / 1;
      }

      .aspect-portrait {
        aspect-ratio: 4 / 5;
      }

      .aspect-auto {
        aspect-ratio: auto;
      }

      .contact-grid {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
        align-items: start;
        gap: 1.5rem;
      }

      .contact-grid-with-image {
        grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
      }

      .contact-column {
        display: grid;
        gap: 1rem;
      }

      .contact-column-primary {
        align-content: start;
      }

      .contact-info {
        display: grid;
        gap: 0.75rem;
      }

      .contact-info-card {
        padding: 1rem 1.1rem;
        border-radius: 1.1rem;
        border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
        background: color-mix(in srgb, var(--surface) 88%, transparent);
      }

      .contact-media {
        margin: 0;
      }

      .contact-form-panel {
        display: grid;
        gap: 0.75rem;
      }

      .contact-feedback {
        margin: 0;
        color: color-mix(in srgb, var(--foreground) 72%, transparent);
      }

      .contact-row {
        display: flex;
        align-items: baseline;
        gap: 0.75rem;
      }

      .contact-label {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--foreground) 52%, transparent);
        min-width: 5.5rem;
      }

      @media (max-width: 900px) {
        .layout-grid,
        .layout-split,
        .hero-content,
        .proof-grid,
        .contact-grid {
          grid-template-columns: 1fr;
        }

        .hero-content {
          padding: 1.25rem;
        }
      }
    `,
  ],
})
export class BusinessLandingPageComponent {
  @Input() embeddedPreview = false;
  @Input() selectedSectionId: string | null = null;

  @Output() sectionSelected = new EventEmitter<string>();

  private readonly api = inject(BusinessApiService);
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  readonly site = this.siteConfig.site;
  readonly siteSlug = injectSiteSlugSignal();
  readonly activeLayout = computed(() => this.site().landingPage.layout);
  readonly layoutClass = computed(
    () => `layout-${this.site().landingPage.layout}`
  );
  readonly offers = toSignal(this.api.getOffers(this.siteSlug()), {
    initialValue: [],
  });
  readonly storeProducts = toSignal(this.api.getStoreProducts(), {
    initialValue: [],
  });
  readonly storefrontProducts = computed(() =>
    this.storeProducts().filter(
      (product) => product.active && product.type !== 'service'
    )
  );
  contactSubmitting = false;
  contactStatus: string | null = null;
  readonly contactSubjects = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'project', label: 'Project Inquiry' },
    { value: 'support', label: 'Support' },
    { value: 'general', label: 'General Inquiry' },
  ];
  readonly gridZones = [
    'hero-wide',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ];
  readonly visibleSections = computed(() =>
    [...this.site().landingPage.sections]
      .sort((a, b) => a.order - b.order)
      .filter((section) => section.enabled)
      .filter((section) => this.isSectionEnabled(section.type))
  );

  clientPortalRoute(): string[] {
    const siteSlug = this.siteSlug();
    return siteSlug ? ['/sites', siteSlug, 'client', 'login'] : ['/client'];
  }

  bookingRoute(): string[] | null {
    const siteSlug = this.siteSlug();
    return siteSlug ? ['/sites', siteSlug, 'book'] : null;
  }

  productViewHref(product: BusinessStoreProduct): string {
    const siteSlug = this.siteSlug();
    return siteSlug
      ? `/sites/${siteSlug}/products/${product.id}`
      : `/products/${product.id}`;
  }

  sectionCtaHref(section: LandingSection): string | null {
    const rawHref = section.ctaHref?.trim();
    if (!rawHref) {
      return null;
    }

    if (rawHref.startsWith('#')) {
      return rawHref;
    }

    if (
      rawHref.startsWith('/') ||
      rawHref.startsWith('http://') ||
      rawHref.startsWith('https://') ||
      rawHref.startsWith('mailto:') ||
      rawHref.startsWith('tel:')
    ) {
      return rawHref;
    }

    const matchedSection = this.site().landingPage.sections.find(
      (candidate) =>
        candidate.id === rawHref ||
        this.slugify(candidate.title) === this.slugify(rawHref)
    );

    return matchedSection
      ? `#${matchedSection.id}`
      : `#${this.slugify(rawHref)}`;
  }

  ownerName(): string {
    return (
      this.site().brand.ownerName ||
      this.site().brand.trainerName ||
      'Business Owner'
    );
  }

  motion(section: LandingSection): LandingSectionMotionConfig | null {
    if (
      section.type === 'hero' &&
      (!section.motion?.kind || section.motion.kind === 'none')
    ) {
      return {
        // Density/speed track the shared defaults; intensity stays lower
        // than the 0.65 default on purpose, since this sits directly behind
        // the hero headline and has to stay readable underneath it.
        kind: 'particle-veil',
        density: 28,
        speed: 1.4,
        intensity: 0.55,
        height: '100%',
        reducedMotion: false,
      };
    }

    return section.motion?.kind && section.motion.kind !== 'none'
      ? section.motion
      : null;
  }

  motionHeight(motion: LandingSectionMotionConfig): string {
    return motion.height || '100%';
  }

  mediaObjectPosition(item: LandingSectionMediaItem): string {
    return (
      {
        center: 'center center',
        top: 'center top',
        right: 'right center',
        bottom: 'center bottom',
        left: 'left center',
      }[item.focalPoint ?? 'center'] ?? 'center center'
    );
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private isSectionEnabled(type: string): boolean {
    if (type === 'store') {
      return this.site().features.store.enabled;
    }

    if (type === 'booking') {
      return this.site().features.booking.enabled;
    }

    if (type === 'testimonials') {
      return this.site().features.testimonials.enabled;
    }

    if (type === 'custom') {
      return true;
    }

    if (type === 'image' || type === 'gallery') {
      return true;
    }

    return true;
  }

  sectionsForZone(layout: 'split' | 'grid', zoneId: string) {
    return this.visibleSections().filter((section) =>
      layout === 'split'
        ? (section.layoutPlacement?.split ??
            this.defaultSplitSlot(section.id)) === zoneId
        : (section.layoutPlacement?.grid ??
            this.defaultGridSlot(section.id)) === zoneId
    );
  }

  onPreviewSectionClick(event: MouseEvent, sectionId: string): void {
    if (!this.embeddedPreview) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.sectionSelected.emit(sectionId);
  }

  storefrontProductCard(product: BusinessStoreProduct) {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
      stock: product.stock,
      type: product.type,
    };
  }

  constructor() {
    this.siteConfig.fetch(false, this.siteSlug()).subscribe();
  }

  submitContactForm(event: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): void {
    this.contactSubmitting = true;
    this.contactStatus = null;

    this.api
      .submitContactLead(
        {
          ...event,
          sourcePage: '/#contact',
        },
        this.site().leadContext?.profileId || undefined
      )
      .subscribe({
        next: () => {
          this.contactSubmitting = false;
          this.contactStatus =
            'Message received. We will reach out with next steps.';
        },
        error: () => {
          this.contactSubmitting = false;
          this.contactStatus =
            'Unable to send the message right now. Please try again shortly.';
        },
      });
  }

  private defaultSplitSlot(sectionId: string): 'primary' | 'secondary' {
    return ['hero', 'about', 'services'].includes(sectionId)
      ? 'primary'
      : 'secondary';
  }

  private defaultGridSlot(sectionId: string): string {
    return (
      (
        {
          hero: 'hero-wide',
          about: 'top-left',
          services: 'top-right',
          testimonials: 'bottom-left',
          contact: 'bottom-right',
          booking: 'bottom-right',
        } as Record<string, string>
      )[sectionId] ?? 'bottom-right'
    );
  }
}
