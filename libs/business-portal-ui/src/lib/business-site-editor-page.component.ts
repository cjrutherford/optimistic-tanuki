import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import {
  BusinessAssetLibraryItem,
  BusinessApiService,
  BusinessAuthService,
  BusinessSiteConfig,
  BusinessSiteConfigStore,
  cloneBusinessSiteConfig,
  GridLayoutSlot,
  LandingSection,
  LandingSectionMediaItem,
  LandingSectionMotionKind,
  normalizeLandingSections,
  SplitLayoutSlot,
} from '@optimistic-tanuki/business-data-access';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { PREDEFINED_PERSONALITIES } from '@optimistic-tanuki/theme-models';
import { firstValueFrom } from 'rxjs';

interface AssetUploadPayload {
  name: string;
  profileId: string;
  type: 'image';
  content: string;
  fileExtension: string;
}

@Component({
  selector: 'business-site-editor-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, CardComponent],
  template: `
    <div class="editor-shell">
      <div class="page-header entrance">
        <h1>Site Content Editor</h1>
        <p>Edit your public landing-page copy, brand identity, and visual theme. Changes take effect after saving.</p>
      </div>

      @if (loading()) {
        <p class="status-msg entrance">Loading current site content…</p>
      } @else {

        <!-- Theme & Appearance section -->
        <otui-card class="section-card entrance" style="animation-delay: 0.06s">
          <h2 class="section-title">
            <span class="section-icon">🎨</span>
            Theme &amp; Appearance
          </h2>
          <div class="field-grid">
            <label>
              Primary Color
              <div class="color-field">
                <input type="color" [(ngModel)]="draft().theme.primaryColor" />
                <input type="text" [(ngModel)]="draft().theme.primaryColor" maxlength="7" />
              </div>
            </label>
            <label>
              Mode
              <select [(ngModel)]="draft().theme.mode">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label class="full">
              Personality
              <div class="personality-grid">
                @for (p of personalities; track p.id) {
                  <button
                    type="button"
                    class="personality-chip"
                    [class.selected]="draft().theme.personalityId === p.id"
                    (click)="draft().theme.personalityId = p.id"
                  >
                    <span class="personality-name">{{ p.name }}</span>
                    <span class="personality-desc">{{ p.category }}</span>
                  </button>
                }
              </div>
            </label>
          </div>
        </otui-card>

        <!-- Brand section -->
        <otui-card class="section-card entrance" style="animation-delay: 0.12s">
          <h2 class="section-title">
            <span class="section-icon">✦</span>
            Brand &amp; Identity
          </h2>
          <div class="field-grid">
            <label>
              Business Name
              <input [(ngModel)]="draft().brand.businessName" />
            </label>
            <label>
              Monogram (2 letters)
              <input [(ngModel)]="draft().brand.monogram" maxlength="3" />
            </label>
            <label>
              Owner Name
              <input [(ngModel)]="draft().brand.ownerName" />
            </label>
            <label>
              Business Type
              <select [(ngModel)]="draft().businessType">
                <option value="general">General</option>
                <option value="consulting">Consulting</option>
                <option value="coaching">Coaching</option>
                <option value="wellness">Wellness</option>
                <option value="fitness">Fitness</option>
              </select>
            </label>
            <label>
              Alternate Public Name
              <input [(ngModel)]="draft().brand.trainerName" />
            </label>
            <label class="full">
              Tagline
              <input [(ngModel)]="draft().brand.tagline" />
            </label>
            <label class="full">
              Short Intro
              <input [(ngModel)]="draft().brand.intro" />
            </label>
            <label class="full">
              Full Bio
              <textarea rows="4" [(ngModel)]="draft().brand.longBio"></textarea>
            </label>
            <label class="full">
              Credentials
              <div class="tag-list">
                @for (cred of draft().brand.credentials; track $index) {
                  <div class="tag-item">
                    <input [(ngModel)]="draft().brand.credentials[$index]" />
                    <button type="button" class="tag-remove" (click)="removeCredential($index)">×</button>
                  </div>
                }
                <button type="button" class="tag-add" (click)="addCredential()">+ Add credential</button>
              </div>
            </label>
            <label class="full">
              Specializations
              <div class="tag-list">
                @for (spec of draft().brand.specializations; track $index) {
                  <div class="tag-item">
                    <input [(ngModel)]="draft().brand.specializations[$index]" />
                    <button type="button" class="tag-remove" (click)="removeSpecialization($index)">×</button>
                  </div>
                }
                <button type="button" class="tag-add" (click)="addSpecialization()">+ Add specialization</button>
              </div>
            </label>
          </div>
        </otui-card>

        <!-- Contact section -->
        <otui-card class="section-card entrance" style="animation-delay: 0.18s">
          <h2 class="section-title">
            <span class="section-icon">✉</span>
            Contact Details
          </h2>
          <div class="field-grid">
            <label>
              Email
              <input type="email" [(ngModel)]="draft().contact.email" />
            </label>
            <label>
              Phone
              <input type="tel" [(ngModel)]="draft().contact.phone" />
            </label>
            <label class="full">
              Location / Notes
              <input [(ngModel)]="draft().contact.location" />
            </label>
            <label>
              Consultation CTA Label
              <input [(ngModel)]="draft().contact.consultationLabel" />
            </label>
          </div>
        </otui-card>

        <otui-card class="section-card entrance" style="animation-delay: 0.21s">
          <h2 class="section-title">
            <span class="section-icon">⚙</span>
            Features
          </h2>
          <div class="feature-row">
            <label class="toggle-card">
              <span class="toggle-copy">
                <strong>Booking</strong>
                <small>Show public booking entry points and booking-related landing content.</small>
              </span>
              <input type="checkbox" [(ngModel)]="draft().features.booking.enabled" />
            </label>
            <label class="toggle-card dependent" [class.disabled]="!draft().features.booking.enabled">
              <span class="toggle-copy">
                <strong>Online payment</strong>
                <small>Allow online payment only when booking is enabled.</small>
              </span>
              <input
                type="checkbox"
                [(ngModel)]="draft().features.booking.allowOnlinePayment"
                [disabled]="!draft().features.booking.enabled"
              />
            </label>
            <label class="toggle-card">
              <span class="toggle-copy">
                <strong>Client portal</strong>
                <small>Show client portal calls to action on the public site.</small>
              </span>
              <input type="checkbox" [(ngModel)]="draft().features.clientPortal.enabled" />
            </label>
            <label class="toggle-card">
              <span class="toggle-copy">
                <strong>Testimonials</strong>
                <small>Render testimonials on the public landing page.</small>
              </span>
              <input type="checkbox" [(ngModel)]="draft().features.testimonials.enabled" />
            </label>
            <label class="toggle-card">
              <span class="toggle-copy">
                <strong>Invoices</strong>
                <small>Keep invoice-related portal features available.</small>
              </span>
              <input type="checkbox" [(ngModel)]="draft().features.invoices.enabled" />
            </label>
            <label class="toggle-card">
              <span class="toggle-copy">
                <strong>Client tasks</strong>
                <small>Enable routines and check-ins across the client and owner portal.</small>
              </span>
              <input type="checkbox" [(ngModel)]="draft().features.clientTasks.enabled" />
            </label>
            <label class="toggle-card dependent" [class.disabled]="!draft().features.clientTasks.enabled">
              <span class="toggle-copy">
                <strong>Client completion</strong>
                <small>Allow clients to mark assigned work complete when tasks are enabled.</small>
              </span>
              <input
                type="checkbox"
                [(ngModel)]="draft().features.clientTasks.allowClientCompletion"
                [disabled]="!draft().features.clientTasks.enabled"
              />
            </label>
          </div>
        </otui-card>

        <otui-card class="section-card entrance" style="animation-delay: 0.225s">
          <h2 class="section-title">
            <span class="section-icon">☰</span>
            Landing Page Layout
          </h2>
          <div class="layout-option-grid">
            @for (option of layoutOptions; track option.value) {
              <button
                type="button"
                class="layout-option-card"
                [class.selected]="draft().landingPage.layout === option.value"
                (click)="setLandingLayout(option.value)"
              >
                <div class="layout-option-preview" [class]="'preview-' + option.value">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div class="layout-option-copy">
                  <strong>{{ option.label }}</strong>
                  <small>{{ option.description }}</small>
                </div>
              </button>
            }
          </div>
          <div class="layout-toolbar">
            <button type="button" class="layout-toolbar-btn" (click)="restoreRecommendedSectionState()">
              Show recommended
            </button>
            <button type="button" class="layout-toolbar-btn" (click)="setAllSectionsEnabled(true)">
              Enable all
            </button>
            <button type="button" class="layout-toolbar-btn" (click)="setAllSectionsEnabled(false)">
              Disable all
            </button>
            <button type="button" class="layout-toolbar-btn" (click)="resetSectionOrder()">
              Reset order
            </button>
          </div>
          <div class="layout-canvas-shell">
            @if (draft().landingPage.layout === 'single-column') {
              <div class="canvas-frame">
                <div class="canvas-heading">
                  <strong>Single-column canvas</strong>
                  <small>Drag sections up or down to control the public narrative flow.</small>
                </div>
                <div
                  class="layout-drop-zone column-zone"
                  data-drop-zone="single-column:main"
                  cdkDropList
                  [id]="dropListId('single-column', 'main')"
                  [cdkDropListData]="sectionIdsForZone('single-column', 'main')"
                  [cdkDropListConnectedTo]="connectedDropLists()"
                  (cdkDropListDropped)="dropSection($event, 'single-column', 'main')"
                >
                  @for (section of sectionsForZone('single-column', 'main'); track section.id) {
                    <div class="canvas-card" cdkDrag>
                      <div class="canvas-card-header">
                        <span class="canvas-card-type">{{ section.type | titlecase }}</span>
                        <span class="canvas-card-order">#{{ section.order + 1 }}</span>
                      </div>
                      @if (sectionPreviewImage(section); as previewImage) {
                        <div class="canvas-card-media">
                          <img [src]="previewImage.src" [alt]="previewImage.alt || section.title" />
                        </div>
                      }
                      <label class="section-toggle">
                        <input
                          type="checkbox"
                          [ngModel]="section.enabled"
                          (ngModelChange)="toggleSectionEnabled(section.id, $event)"
                        />
                        <span>{{ section.title }}</span>
                      </label>
                      <p class="section-help">{{ sectionDescription(section.type) }}</p>
                      <p class="canvas-card-summary">{{ sectionSummary(section) }}</p>
                      <div class="canvas-card-meta">
                        @if (section.motion?.kind && section.motion?.kind !== 'none') {
                          <span class="canvas-card-chip accent">Motion: {{ motionLabel(section.motion?.kind ?? 'none') }}</span>
                        }
                        @if (section.type === 'gallery') {
                          <span class="canvas-card-chip">Gallery • {{ section.gallery?.items?.length ?? 0 }} items</span>
                        }
                        @if (section.type === 'image') {
                          <span class="canvas-card-chip">Image block</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            } @else if (draft().landingPage.layout === 'split') {
              <div class="canvas-frame">
                <div class="canvas-heading">
                  <strong>Split canvas</strong>
                  <small>Drag sections between the primary and secondary columns to mirror the live layout.</small>
                </div>
                <div class="split-canvas">
                  @for (zone of splitZones; track zone.id) {
                    <div class="canvas-lane">
                      <div class="canvas-lane-head">
                        <strong>{{ zone.label }}</strong>
                        <small>{{ zone.description }}</small>
                      </div>
                      <div
                        class="layout-drop-zone"
                        [attr.data-drop-zone]="'split:' + zone.id"
                        cdkDropList
                        [id]="dropListId('split', zone.id)"
                        [cdkDropListData]="sectionIdsForZone('split', zone.id)"
                        [cdkDropListConnectedTo]="connectedDropLists()"
                        (cdkDropListDropped)="dropSection($event, 'split', zone.id)"
                      >
                        @for (section of sectionsForZone('split', zone.id); track section.id) {
                          <div class="canvas-card" cdkDrag>
                            <div class="canvas-card-header">
                              <span class="canvas-card-type">{{ section.type | titlecase }}</span>
                              <span class="canvas-card-order">#{{ section.order + 1 }}</span>
                            </div>
                            @if (sectionPreviewImage(section); as previewImage) {
                              <div class="canvas-card-media">
                                <img [src]="previewImage.src" [alt]="previewImage.alt || section.title" />
                              </div>
                            }
                            <label class="section-toggle">
                              <input
                                type="checkbox"
                                [ngModel]="section.enabled"
                                (ngModelChange)="toggleSectionEnabled(section.id, $event)"
                              />
                              <span>{{ section.title }}</span>
                            </label>
                            <p class="section-help">{{ sectionDescription(section.type) }}</p>
                            <p class="canvas-card-summary">{{ sectionSummary(section) }}</p>
                            <div class="canvas-card-meta">
                              @if (section.motion?.kind && section.motion?.kind !== 'none') {
                                <span class="canvas-card-chip accent">Motion: {{ motionLabel(section.motion?.kind ?? 'none') }}</span>
                              }
                              @if (section.type === 'gallery') {
                                <span class="canvas-card-chip">Gallery • {{ section.gallery?.items?.length ?? 0 }} items</span>
                              }
                              @if (section.type === 'image') {
                                <span class="canvas-card-chip">Image block</span>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            } @else {
              <div class="canvas-frame">
                <div class="canvas-heading">
                  <strong>Grid canvas</strong>
                  <small>Place sections into the grid slots the public landing page will use.</small>
                </div>
                <div class="grid-canvas">
                  @for (zone of gridZones; track zone.id) {
                    <div class="canvas-lane" [class]="'grid-zone-' + zone.id">
                      <div class="canvas-lane-head">
                        <strong>{{ zone.label }}</strong>
                        <small>{{ zone.description }}</small>
                      </div>
                      <div
                        class="layout-drop-zone"
                        [attr.data-drop-zone]="'grid:' + zone.id"
                        cdkDropList
                        [id]="dropListId('grid', zone.id)"
                        [cdkDropListData]="sectionIdsForZone('grid', zone.id)"
                        [cdkDropListConnectedTo]="connectedDropLists()"
                        (cdkDropListDropped)="dropSection($event, 'grid', zone.id)"
                      >
                        @for (section of sectionsForZone('grid', zone.id); track section.id) {
                          <div class="canvas-card" cdkDrag>
                            <div class="canvas-card-header">
                              <span class="canvas-card-type">{{ section.type | titlecase }}</span>
                              <span class="canvas-card-order">#{{ section.order + 1 }}</span>
                            </div>
                            @if (sectionPreviewImage(section); as previewImage) {
                              <div class="canvas-card-media">
                                <img [src]="previewImage.src" [alt]="previewImage.alt || section.title" />
                              </div>
                            }
                            <label class="section-toggle">
                              <input
                                type="checkbox"
                                [ngModel]="section.enabled"
                                (ngModelChange)="toggleSectionEnabled(section.id, $event)"
                              />
                              <span>{{ section.title }}</span>
                            </label>
                            <p class="section-help">{{ sectionDescription(section.type) }}</p>
                            <p class="canvas-card-summary">{{ sectionSummary(section) }}</p>
                            <div class="canvas-card-meta">
                              @if (section.motion?.kind && section.motion?.kind !== 'none') {
                                <span class="canvas-card-chip accent">Motion: {{ motionLabel(section.motion?.kind ?? 'none') }}</span>
                              }
                              @if (section.type === 'gallery') {
                                <span class="canvas-card-chip">Gallery • {{ section.gallery?.items?.length ?? 0 }} items</span>
                              }
                              @if (section.type === 'image') {
                                <span class="canvas-card-chip">Image block</span>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
          <div class="layout-list">
            @for (section of draft().landingPage.sections; track section.id; let i = $index) {
              <div class="layout-row">
                <div class="layout-row-main">
                  <label class="full">
                    Title
                    <input [(ngModel)]="draft().landingPage.sections[i].title" />
                  </label>
                  @if (section.type === 'custom') {
                    <label class="full">
                      Body
                      <textarea [(ngModel)]="draft().landingPage.sections[i].body" rows="3"></textarea>
                    </label>
                    <label>
                      CTA Label
                      <input [(ngModel)]="draft().landingPage.sections[i].ctaLabel" />
                    </label>
                    <label>
                      CTA Link
                      <input [(ngModel)]="draft().landingPage.sections[i].ctaHref" />
                    </label>
                  }
                  @if (section.type === 'image') {
                    <div class="full media-editor">
                      <div class="media-editor-head">
                        <strong>Image block</strong>
                        <small>Choose a direct URL or an asset-backed path and control the image treatment.</small>
                      </div>
                      <div class="field-grid">
                        <label>
                          Source Type
                          <select [(ngModel)]="draft().landingPage.sections[i].image!.sourceType">
                            <option value="url">External URL</option>
                            <option value="asset">Asset path</option>
                          </select>
                        </label>
                        <label class="full">
                          {{ draft().landingPage.sections[i].image!.sourceType === 'asset' ? 'Asset path' : 'Image URL' }}
                          <input [(ngModel)]="draft().landingPage.sections[i].image!.src" />
                        </label>
                        <label>
                          Alt Text
                          <input [(ngModel)]="draft().landingPage.sections[i].image!.alt" />
                        </label>
                        <label>
                          Caption
                          <input [(ngModel)]="draft().landingPage.sections[i].image!.caption" />
                        </label>
                        <label>
                          Aspect
                          <select [(ngModel)]="draft().landingPage.sections[i].image!.aspect">
                            <option value="landscape">Landscape</option>
                            <option value="square">Square</option>
                            <option value="portrait">Portrait</option>
                            <option value="auto">Auto</option>
                          </select>
                        </label>
                        <label>
                          Fit
                          <select [(ngModel)]="draft().landingPage.sections[i].image!.fit">
                            <option value="cover">Cover</option>
                            <option value="contain">Contain</option>
                          </select>
                        </label>
                        <label>
                          Focal Point
                          <select [(ngModel)]="draft().landingPage.sections[i].image!.focalPoint">
                            <option value="center">Center</option>
                            <option value="top">Top</option>
                            <option value="right">Right</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                          </select>
                        </label>
                      </div>
                      <div class="media-actions">
                        <input
                          #imageUploadInput
                          type="file"
                          accept="image/*"
                          class="visually-hidden"
                          (change)="onAssetFileSelected(i, null, $event)"
                        />
                        <button type="button" class="layout-btn" (click)="imageUploadInput.click()">
                          {{ isUploading(assetTargetKey(i)) ? 'Uploading…' : 'Upload image' }}
                        </button>
                        <button type="button" class="layout-btn" (click)="toggleAssetPicker(i)">
                          {{ isAssetPickerOpen(i) ? 'Hide asset library' : 'Choose existing asset' }}
                        </button>
                        <button type="button" class="layout-btn" (click)="loadOwnerAssets(true)">
                          Refresh assets
                        </button>
                      </div>
                      @if (isAssetPickerOpen(i)) {
                        <div class="asset-picker">
                          <div class="asset-picker-head">
                            <strong>Asset library</strong>
                            <small>Choose from previously uploaded images tied to your owner profile.</small>
                          </div>
                          @if (assetsLoading()) {
                            <p class="section-help">Loading assets…</p>
                          } @else if (assetLibraryError()) {
                            <p class="status-msg error">{{ assetLibraryError() }}</p>
                          } @else if (assetLibrary().length) {
                            <div class="asset-grid">
                              @for (asset of assetLibrary(); track asset.id) {
                                <button type="button" class="asset-tile" (click)="selectAsset(i, null, asset)">
                                  <img [src]="asset.url" [alt]="asset.name" />
                                  <span>{{ asset.name }}</span>
                                </button>
                              }
                            </div>
                          } @else {
                            <p class="section-help">No uploaded image assets yet.</p>
                          }
                        </div>
                      }
                    </div>
                  }
                  @if (section.type === 'gallery') {
                    <div class="full media-editor">
                      <div class="media-editor-head">
                        <strong>Gallery block</strong>
                        <small>Build a client-facing image collection with layout and per-item metadata.</small>
                      </div>
                      <div class="field-grid">
                        <label>
                          Style
                          <select [(ngModel)]="draft().landingPage.sections[i].gallery!.style">
                            <option value="grid">Grid</option>
                            <option value="masonry">Masonry</option>
                          </select>
                        </label>
                        <label>
                          Columns
                          <select [(ngModel)]="draft().landingPage.sections[i].gallery!.columns">
                            <option [ngValue]="2">2 columns</option>
                            <option [ngValue]="3">3 columns</option>
                            <option [ngValue]="4">4 columns</option>
                          </select>
                        </label>
                      </div>
                      <div class="gallery-list">
                        @for (item of draft().landingPage.sections[i].gallery!.items; track $index) {
                          <div class="gallery-item-editor">
                            <div class="testimonial-header">
                              <span class="testimonial-number">Image #{{ $index + 1 }}</span>
                              <button type="button" class="tag-remove" (click)="removeGalleryItem(i, $index)">Remove</button>
                            </div>
                            <div class="field-grid">
                              <label>
                                Source Type
                                <select [(ngModel)]="draft().landingPage.sections[i].gallery!.items[$index].sourceType">
                                  <option value="url">External URL</option>
                                  <option value="asset">Asset path</option>
                                </select>
                              </label>
                              <label class="full">
                                {{ draft().landingPage.sections[i].gallery!.items[$index].sourceType === 'asset' ? 'Asset path' : 'Image URL' }}
                                <input [(ngModel)]="draft().landingPage.sections[i].gallery!.items[$index].src" />
                              </label>
                              <label>
                                Alt Text
                                <input [(ngModel)]="draft().landingPage.sections[i].gallery!.items[$index].alt" />
                              </label>
                              <label>
                                Caption
                                <input [(ngModel)]="draft().landingPage.sections[i].gallery!.items[$index].caption" />
                              </label>
                            </div>
                            <div class="media-actions">
                              <input
                                #galleryUploadInput
                                type="file"
                                accept="image/*"
                                class="visually-hidden"
                                (change)="onAssetFileSelected(i, $index, $event)"
                              />
                              <button type="button" class="layout-btn" (click)="galleryUploadInput.click()">
                                {{ isUploading(assetTargetKey(i, $index)) ? 'Uploading…' : 'Upload image' }}
                              </button>
                              <button type="button" class="layout-btn" (click)="toggleAssetPicker(i, $index)">
                                {{ isAssetPickerOpen(i, $index) ? 'Hide asset library' : 'Choose existing asset' }}
                              </button>
                            </div>
                            @if (isAssetPickerOpen(i, $index)) {
                              <div class="asset-picker">
                                <div class="asset-picker-head">
                                  <strong>Asset library</strong>
                                  <small>Select an uploaded image for this gallery slot.</small>
                                </div>
                                @if (assetsLoading()) {
                                  <p class="section-help">Loading assets…</p>
                                } @else if (assetLibraryError()) {
                                  <p class="status-msg error">{{ assetLibraryError() }}</p>
                                } @else if (assetLibrary().length) {
                                  <div class="asset-grid">
                                    @for (asset of assetLibrary(); track asset.id) {
                                      <button type="button" class="asset-tile" (click)="selectAsset(i, $index, asset)">
                                        <img [src]="asset.url" [alt]="asset.name" />
                                        <span>{{ asset.name }}</span>
                                      </button>
                                    }
                                  </div>
                                } @else {
                                  <p class="section-help">No uploaded image assets yet.</p>
                                }
                              </div>
                            }
                          </div>
                        }
                        <button type="button" class="tag-add" (click)="addGalleryItem(i)">+ Add gallery image</button>
                      </div>
                    </div>
                  }
                  <div class="full motion-editor">
                    <div class="media-editor-head">
                      <strong>Motion layer</strong>
                      <small>Apply an optional motion-ui treatment behind this section and tune the effect.</small>
                    </div>
                    <div class="field-grid">
                      <label>
                        Motion Component
                        <select [(ngModel)]="draft().landingPage.sections[i].motion!.kind">
                          @for (option of motionOptions; track option.value) {
                            <option [value]="option.value">{{ option.label }}</option>
                          }
                        </select>
                      </label>
                      <label>
                        Height
                        <input [(ngModel)]="draft().landingPage.sections[i].motion!.height" />
                      </label>
                      <label>
                        Density
                        <input type="number" min="1" [(ngModel)]="draft().landingPage.sections[i].motion!.density" />
                      </label>
                      <label>
                        Speed
                        <input type="number" min="0.1" step="0.1" [(ngModel)]="draft().landingPage.sections[i].motion!.speed" />
                      </label>
                      <label>
                        Intensity
                        <input type="number" min="0" max="1" step="0.05" [(ngModel)]="draft().landingPage.sections[i].motion!.intensity" />
                      </label>
                      <label class="checkbox-line">
                        <span>Reduced Motion</span>
                        <input type="checkbox" [(ngModel)]="draft().landingPage.sections[i].motion!.reducedMotion" />
                      </label>
                      @if (draft().landingPage.sections[i].motion!.kind === 'shimmer-beam') {
                        <label>
                          Direction
                          <select [(ngModel)]="draft().landingPage.sections[i].motion!.direction">
                            <option value="diagonal">Diagonal</option>
                            <option value="horizontal">Horizontal</option>
                          </select>
                        </label>
                      }
                      @if (draft().landingPage.sections[i].motion!.kind === 'pulse-rings') {
                        <label>
                          Ring Count
                          <input type="number" min="1" max="8" [(ngModel)]="draft().landingPage.sections[i].motion!.ringCount" />
                        </label>
                      }
                    </div>
                  </div>
                </div>
                <div class="layout-actions">
                  <button type="button" class="layout-btn" (click)="moveSectionUp(i)" [disabled]="i === 0">
                    Move up
                  </button>
                  <button
                    type="button"
                    class="layout-btn"
                    (click)="moveSectionDown(i)"
                    [disabled]="i === draft().landingPage.sections.length - 1"
                  >
                    Move down
                  </button>
                  @if (section.type === 'custom') {
                    <button type="button" class="layout-btn" (click)="removeSection(i)">
                      Remove
                    </button>
                  }
                </div>
              </div>
            }
          </div>
          <div class="layout-footer">
            <button type="button" class="tag-add" (click)="addCustomSection()">+ Add custom section</button>
            <button type="button" class="tag-add" (click)="addImageSection()">+ Add image block</button>
            <button type="button" class="tag-add" (click)="addGallerySection()">+ Add gallery block</button>
          </div>
        </otui-card>

        <otui-card class="section-card entrance" style="animation-delay: 0.235s">
          <h2 class="section-title">
            <span class="section-icon">◫</span>
            Offers
          </h2>
          <div class="service-list">
            @for (service of draft().services; track service.id; let i = $index) {
              <div class="service-card">
                <div class="testimonial-header">
                  <span class="testimonial-number">Offer #{{ $index + 1 }}</span>
                  <button type="button" class="tag-remove" (click)="removeService(i)">Remove</button>
                </div>
                <div class="field-grid">
                  <label>
                    Offer name
                    <input [(ngModel)]="draft().services[i].name" />
                  </label>
                  <label>
                    Hourly price
                    <input type="number" [(ngModel)]="draft().services[i].price" />
                  </label>
                  <label>
                    Duration (minutes)
                    <input type="number" [(ngModel)]="draft().services[i].duration" />
                  </label>
                  <label>
                    Public booking
                    <input type="checkbox" [(ngModel)]="draft().services[i].allowOnlineBooking" />
                  </label>
                  <label class="full">
                    Description
                    <textarea rows="3" [(ngModel)]="draft().services[i].description"></textarea>
                  </label>
                </div>
              </div>
            } @empty {
              <p class="status-msg">
                No offers defined yet. Add at least one offer so the public site can describe what you sell.
              </p>
            }
            <button type="button" class="tag-add" (click)="addService()">+ Add offer</button>
          </div>
        </otui-card>

        <!-- Client Portal copy section -->
        <otui-card class="section-card entrance" style="animation-delay: 0.24s">
          <h2 class="section-title">
            <span class="section-icon">◈</span>
            Client Portal Copy
          </h2>
          <div class="field-grid">
            <label class="full">
              Headline
              <input [(ngModel)]="draft().clientPortal.headline" />
            </label>
            <label class="full">
              Description
              <textarea rows="3" [(ngModel)]="draft().clientPortal.description"></textarea>
            </label>
            <label class="full">
              Capabilities
              <div class="tag-list">
                @for (capability of draft().clientPortal.capabilities; track $index) {
                  <div class="tag-item">
                    <input [(ngModel)]="draft().clientPortal.capabilities[$index]" />
                    <button type="button" class="tag-remove" (click)="removeCapability($index)">×</button>
                  </div>
                }
                <button type="button" class="tag-add" (click)="addCapability()">+ Add capability</button>
              </div>
            </label>
          </div>
        </otui-card>

        <!-- Testimonials section -->
        <otui-card class="section-card entrance" style="animation-delay: 0.3s">
          <h2 class="section-title">
            <span class="section-icon">❝</span>
            Testimonials
          </h2>
          <div class="testimonial-list">
            @for (t of draft().testimonials; track $index) {
              <div class="testimonial-entry">
                <div class="testimonial-header">
                  <span class="testimonial-number">#{{ $index + 1 }}</span>
                  <button type="button" class="tag-remove" (click)="removeTestimonial($index)">Remove</button>
                </div>
                <label>
                  Quote
                  <textarea rows="2" [(ngModel)]="t.quote"></textarea>
                </label>
                <label>
                  Client Name
                  <input [(ngModel)]="t.clientName" />
                </label>
                <label>
                  Client Detail
                  <input [(ngModel)]="t.clientDetail" />
                </label>
              </div>
            }
            <button type="button" class="tag-add" (click)="addTestimonial()">+ Add testimonial</button>
          </div>
        </otui-card>

        <!-- Actions -->
        @if (successMsg()) {
          <p class="status-msg success entrance">{{ successMsg() }}</p>
        }
        @if (errorMsg()) {
          <p class="status-msg error entrance">{{ errorMsg() }}</p>
        }

        <div class="actions entrance" style="animation-delay: 0.36s">
          <button class="otui-btn primary" [disabled]="saving()" (click)="save()">
            @if (saving()) { Saving… } @else { Save Changes }
          </button>
          <button class="otui-btn ghost" (click)="reset()">Reset to Defaults</button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      @keyframes entrance-up {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .editor-shell {
        display: grid;
        gap: 1.5rem;
      }

      .entrance {
        animation: entrance-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        opacity: 0;
      }

      .page-header h1 {
        margin: 0 0 0.4rem;
        font-family: var(--font-heading, 'Instrument Serif', serif);
        font-weight: 400;
        font-size: 2rem;
        color: var(--foreground);
      }

      .page-header p {
        margin: 0;
        color: var(--muted, #6b7280);
      }

      .section-card {
        display: grid;
        gap: 1.2rem;
      }

      .section-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: var(--foreground, #0f172a);
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border, #e2e8f0);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .section-icon {
        font-size: 1.1rem;
        opacity: 0.7;
      }

      .field-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .field-grid label.full {
        grid-column: 1 / -1;
      }

      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.82rem;
        font-weight: 500;
        color: var(--foreground, #0f172a);
      }

      input,
      textarea,
      select {
        padding: 0.6rem 0.85rem;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--personality-border-radius, 0.5rem);
        background: var(--surface, #fff);
        color: var(--foreground, #0f172a);
        font-size: 0.9rem;
        font-family: inherit;
        resize: vertical;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      input:focus,
      textarea:focus,
      select:focus {
        outline: none;
        border-color: var(--primary, #1f7a63);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary, #1f7a63) 14%, transparent);
      }

      select {
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.7rem center;
        padding-right: 2rem;
      }

      .color-field {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .color-field input[type="color"] {
        width: 3rem;
        height: 2.5rem;
        padding: 0.2rem;
        cursor: pointer;
      }

      .color-field input[type="text"] {
        flex: 1;
        font-family: monospace;
        text-transform: uppercase;
      }

      .personality-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.5rem;
      }

      .personality-chip {
        display: grid;
        gap: 0.15rem;
        padding: 0.65rem 0.8rem;
        border-radius: var(--personality-card-radius, 0.75rem);
        border: var(--personality-border-width, 1px) solid var(--border);
        background: var(--background);
        cursor: pointer;
        text-align: left;
        transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
      }

      .personality-chip:hover {
        border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
        transform: translateY(-2px);
        box-shadow: 0 6px 16px color-mix(in srgb, var(--primary) 6%, rgba(0,0,0,0.04));
      }

      .personality-chip.selected {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 8%, var(--background));
        box-shadow: 0 0 0 1px var(--primary);
      }

      .personality-name {
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--foreground);
      }

      .personality-desc {
        font-size: 0.75rem;
        text-transform: capitalize;
        color: color-mix(in srgb, var(--foreground) 55%, transparent);
      }

      .tag-list {
        display: grid;
        gap: 0.4rem;
      }

      .tag-item {
        display: flex;
        gap: 0.4rem;
        align-items: center;
      }

      .tag-item input {
        flex: 1;
      }

      .tag-remove {
        padding: 0.4rem 0.6rem;
        border-radius: var(--personality-border-radius, 0.35rem);
        border: none;
        background: color-mix(in srgb, var(--danger, #ef4444) 10%, transparent);
        color: var(--danger, #ef4444);
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .tag-remove:hover {
        background: color-mix(in srgb, var(--danger) 18%, transparent);
      }

      .tag-add {
        padding: 0.55rem 0.85rem;
        border-radius: var(--personality-border-radius, 0.5rem);
        border: var(--personality-border-width, 1px) dashed var(--border);
        background: transparent;
        color: var(--primary);
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: border-color 0.2s ease, background 0.2s ease;
        width: fit-content;
      }

      .tag-add:hover {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 6%, transparent);
      }

      .feature-row {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(220px, 1fr);
        gap: 0.85rem;
        overflow-x: auto;
        padding-bottom: 0.25rem;
      }

      .toggle-card {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.85rem;
        align-items: start;
        min-height: 100%;
        padding: 1rem;
        border-radius: var(--personality-card-radius, 1rem);
        border: 1px solid var(--border, #e2e8f0);
        background: color-mix(in srgb, var(--background, #ffffff) 94%, white);
      }

      .toggle-card.dependent.disabled {
        opacity: 0.6;
      }

      .toggle-copy {
        display: grid;
        gap: 0.3rem;
      }

      .toggle-copy strong {
        font-size: 0.95rem;
        color: var(--foreground, #0f172a);
      }

      .toggle-copy small {
        color: var(--muted, #6b7280);
        line-height: 1.45;
      }

      .toggle-card input[type='checkbox'] {
        width: 1.1rem;
        height: 1.1rem;
        margin-top: 0.15rem;
      }

      .layout-option-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.85rem;
      }

      .layout-option-card {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border-radius: var(--personality-card-radius, 1rem);
        border: 1px solid var(--border, #e2e8f0);
        background: color-mix(in srgb, var(--background, #ffffff) 96%, white);
        cursor: pointer;
        text-align: left;
        transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .layout-option-card:hover {
        transform: translateY(-2px);
        border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
        box-shadow: 0 10px 24px color-mix(in srgb, var(--primary) 8%, rgba(0,0,0,0.06));
      }

      .layout-option-card.selected {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 8%, var(--background));
        box-shadow: 0 0 0 1px var(--primary);
      }

      .layout-option-preview {
        display: grid;
        gap: 0.35rem;
        min-height: 4rem;
      }

      .layout-option-preview span {
        display: block;
        border-radius: 0.6rem;
        background: color-mix(in srgb, var(--primary) 16%, var(--surface, white));
        border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
      }

      .preview-single-column span:nth-child(1) {
        min-height: 1.35rem;
      }

      .preview-single-column span:nth-child(2),
      .preview-single-column span:nth-child(3) {
        min-height: 0.8rem;
      }

      .preview-split {
        grid-template-columns: 1.35fr 0.9fr;
      }

      .preview-split span:first-child {
        grid-row: 1 / span 2;
      }

      .preview-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .preview-grid span:first-child {
        grid-column: 1 / -1;
      }

      .layout-option-copy {
        display: grid;
        gap: 0.2rem;
      }

      .layout-option-copy strong {
        color: var(--foreground);
        font-size: 0.92rem;
      }

      .layout-option-copy small {
        color: var(--muted, #6b7280);
        line-height: 1.45;
      }

      .layout-toolbar {
        display: flex;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .layout-canvas-shell {
        display: grid;
        gap: 1rem;
      }

      .canvas-frame {
        display: grid;
        gap: 1rem;
        padding: 1rem;
        border-radius: var(--personality-card-radius, 1rem);
        border: 1px solid var(--border, #e2e8f0);
        background:
          radial-gradient(circle at top right, color-mix(in srgb, var(--primary) 9%, transparent), transparent 42%),
          color-mix(in srgb, var(--background, #ffffff) 97%, white);
      }

      .canvas-heading {
        display: grid;
        gap: 0.2rem;
      }

      .canvas-heading strong {
        color: var(--foreground);
      }

      .canvas-heading small {
        color: var(--muted, #6b7280);
        line-height: 1.45;
      }

      .split-canvas {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(240px, 0.9fr);
        gap: 1rem;
      }

      .grid-canvas {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .grid-zone-hero-wide {
        grid-column: 1 / -1;
      }

      .canvas-lane {
        display: grid;
        gap: 0.7rem;
      }

      .canvas-lane-head {
        display: grid;
        gap: 0.2rem;
      }

      .canvas-lane-head strong {
        color: var(--foreground);
        font-size: 0.9rem;
      }

      .canvas-lane-head small {
        color: var(--muted, #6b7280);
        line-height: 1.4;
      }

      .layout-drop-zone {
        display: grid;
        gap: 0.75rem;
        min-height: 8rem;
        padding: 0.8rem;
        border-radius: var(--personality-card-radius, 1rem);
        border: 1px dashed color-mix(in srgb, var(--primary) 30%, var(--border));
        background: color-mix(in srgb, var(--surface, #fff) 92%, transparent);
      }

      .column-zone {
        min-height: 15rem;
      }

      .canvas-card {
        display: grid;
        gap: 0.55rem;
        padding: 0.85rem;
        border-radius: 0.9rem;
        border: 1px solid var(--border, #e2e8f0);
        background: var(--background, #fff);
        box-shadow: 0 10px 26px color-mix(in srgb, var(--primary) 5%, rgba(0,0,0,0.04));
        cursor: move;
      }

      .canvas-card-media {
        aspect-ratio: 16 / 9;
        overflow: hidden;
        border-radius: 0.75rem;
        border: 1px solid color-mix(in srgb, var(--primary) 10%, var(--border));
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, transparent), transparent),
          color-mix(in srgb, var(--surface, #fff) 88%, var(--background, #fff));
      }

      .canvas-card-media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .canvas-card-header {
        display: flex;
        justify-content: space-between;
        gap: 0.6rem;
        align-items: center;
      }

      .canvas-card-type,
      .canvas-card-order {
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .canvas-card-type {
        color: var(--primary);
      }

      .canvas-card-order {
        color: var(--muted, #6b7280);
      }

      .canvas-card-summary {
        margin: 0;
        color: color-mix(in srgb, var(--foreground) 72%, transparent);
        font-size: 0.82rem;
        line-height: 1.45;
      }

      .canvas-card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .canvas-card-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.28rem 0.6rem;
        border-radius: 999px;
        border: 1px solid var(--border, #e2e8f0);
        background: color-mix(in srgb, var(--surface, #fff) 92%, transparent);
        color: color-mix(in srgb, var(--foreground) 74%, transparent);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .canvas-card-chip.accent {
        border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
        color: var(--primary);
      }

      .layout-toolbar-btn,
      .layout-btn {
        padding: 0.55rem 0.8rem;
        border-radius: 999px;
        border: 1px solid var(--border, #e2e8f0);
        background: var(--surface, #fff);
        color: var(--foreground, #0f172a);
        cursor: pointer;
        font-size: 0.84rem;
        font-weight: 600;
        transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
      }

      .layout-toolbar-btn:hover,
      .layout-btn:hover:not(:disabled) {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 6%, transparent);
        transform: translateY(-1px);
      }

      .layout-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .layout-list {
        display: grid;
        gap: 0.9rem;
      }

      .layout-footer {
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .layout-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--personality-card-radius, 1rem);
        background: color-mix(in srgb, var(--background, #ffffff) 96%, white);
      }

      .layout-row-main {
        display: grid;
        gap: 0.7rem;
      }

      .media-editor,
      .motion-editor {
        display: grid;
        gap: 0.85rem;
        padding: 1rem;
        border-radius: 0.9rem;
        border: 1px solid color-mix(in srgb, var(--primary) 10%, var(--border));
        background: color-mix(in srgb, var(--surface, #fff) 92%, transparent);
      }

      .media-editor-head {
        display: grid;
        gap: 0.2rem;
      }

      .media-editor-head strong {
        color: var(--foreground);
        font-size: 0.9rem;
      }

      .media-editor-head small {
        color: var(--muted, #6b7280);
        line-height: 1.45;
      }

      .gallery-list {
        display: grid;
        gap: 0.8rem;
      }

      .media-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .asset-picker {
        display: grid;
        gap: 0.75rem;
        padding: 0.85rem;
        border-radius: 0.85rem;
        border: 1px solid color-mix(in srgb, var(--primary) 12%, var(--border));
        background: var(--background, #fff);
      }

      .asset-picker-head {
        display: grid;
        gap: 0.2rem;
      }

      .asset-picker-head strong {
        font-size: 0.88rem;
        color: var(--foreground);
      }

      .asset-picker-head small {
        color: var(--muted, #6b7280);
        line-height: 1.45;
      }

      .asset-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 0.7rem;
      }

      .asset-tile {
        display: grid;
        gap: 0.45rem;
        padding: 0.5rem;
        border-radius: 0.8rem;
        border: 1px solid var(--border, #e2e8f0);
        background: color-mix(in srgb, var(--surface, #fff) 92%, transparent);
        color: var(--foreground, #0f172a);
        cursor: pointer;
        text-align: left;
        transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      }

      .asset-tile:hover {
        border-color: var(--primary);
        transform: translateY(-1px);
        box-shadow: 0 10px 22px color-mix(in srgb, var(--primary) 7%, rgba(0,0,0,0.05));
      }

      .asset-tile img {
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        border-radius: 0.65rem;
        display: block;
      }

      .asset-tile span {
        font-size: 0.76rem;
        font-weight: 600;
        color: color-mix(in srgb, var(--foreground) 78%, transparent);
        word-break: break-word;
      }

      .gallery-item-editor {
        display: grid;
        gap: 0.7rem;
        padding: 0.85rem;
        border-radius: 0.85rem;
        border: 1px solid var(--border, #e2e8f0);
        background: var(--background, #fff);
      }

      .checkbox-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .section-toggle {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        font-size: 0.95rem;
        font-weight: 700;
      }

      .section-help {
        margin: 0;
        color: var(--muted, #6b7280);
        font-size: 0.84rem;
        line-height: 1.45;
      }

      .layout-actions {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        justify-content: flex-start;
      }

      .testimonial-list {
        display: grid;
        gap: 1rem;
      }

      .service-list {
        display: grid;
        gap: 1rem;
      }

      .service-card {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border: var(--personality-border-width, 1px) solid var(--border);
        border-radius: var(--personality-card-radius, 1rem);
        background: var(--background);
      }

      .testimonial-entry {
        display: grid;
        gap: 0.6rem;
        padding: 1rem;
        border: var(--personality-border-width, 1px) solid var(--border);
        border-radius: var(--personality-card-radius, 1rem);
        background: var(--background);
        transition: box-shadow 0.2s ease, transform 0.2s ease;
      }

      .testimonial-entry:hover {
        box-shadow: 0 8px 24px color-mix(in srgb, var(--primary) 6%, rgba(0,0,0,0.04));
        transform: translateY(-2px);
      }

      .testimonial-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.25rem;
      }

      .testimonial-number {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--primary);
        letter-spacing: 0.05em;
      }

      .actions {
        display: flex;
        gap: 0.75rem;
        position: sticky;
        bottom: 1rem;
        padding: 1rem;
        background: color-mix(in srgb, var(--background) 92%, transparent);
        backdrop-filter: blur(12px);
        border-radius: var(--personality-card-radius, 1rem);
        border: var(--personality-border-width, 1px) solid var(--border);
        box-shadow: var(--personality-card-shadow, 0 12px 32px rgba(0,0,0,0.08));
      }

      .otui-btn {
        padding: 0.75rem 1.6rem;
        border-radius: var(--personality-button-radius, 999px);
        cursor: pointer;
        font-size: 0.92rem;
        font-weight: 600;
        font-family: inherit;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
          box-shadow 0.2s ease, background 0.2s ease;
        will-change: transform;
      }

      .otui-btn:hover:not(:disabled) {
        transform: translateY(-2px);
      }

      .otui-btn.primary {
        background: var(--primary, #1f7a63);
        color: var(--primary-foreground, white);
        border: none;
        box-shadow: 0 6px 16px color-mix(in srgb, var(--primary) 24%, transparent);
      }

      .otui-btn.primary:hover:not(:disabled) {
        background: color-mix(in srgb, var(--primary, #1f7a63) 88%, black);
        box-shadow: 0 8px 22px color-mix(in srgb, var(--primary) 32%, transparent);
      }

      .otui-btn.ghost {
        background: transparent;
        border: 1px solid var(--border, #e2e8f0);
        color: var(--foreground, #0f172a);
      }

      .otui-btn.ghost:hover {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 6%, transparent);
      }

      .otui-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .status-msg {
        font-size: 0.88rem;
        padding: 0.75rem 1rem;
        border-radius: var(--personality-border-radius, 0.5rem);
        margin: 0;
        font-weight: 500;
      }

      .status-msg.success {
        color: color-mix(in srgb, var(--success, #166534) 90%, black);
        background: color-mix(in srgb, var(--success, #dcfce7) 20%, transparent);
        border: var(--personality-border-width, 1px) solid color-mix(in srgb, var(--success) 30%, transparent);
      }

      .status-msg.error {
        color: color-mix(in srgb, var(--danger, #991b1b) 90%, black);
        background: color-mix(in srgb, var(--danger, #fee2e2) 20%, transparent);
        border: var(--personality-border-width, 1px) solid color-mix(in srgb, var(--danger) 30%, transparent);
      }

      @media (max-width: 640px) {
        .field-grid {
          grid-template-columns: 1fr;
        }

        .layout-option-grid,
        .layout-row,
        .split-canvas,
        .grid-canvas {
          grid-template-columns: 1fr;
        }

        .layout-actions {
          flex-direction: row;
          flex-wrap: wrap;
        }

        .personality-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .feature-row {
          grid-auto-flow: row;
          grid-auto-columns: auto;
        }
      }
    `,
  ],
})
export class BusinessSiteEditorPageComponent {
  private readonly api = inject(BusinessApiService);
  private readonly auth = inject(BusinessAuthService);
  private readonly http = inject(HttpClient);
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly themeService = inject(ThemeService);

  loading = signal(true);
  saving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');
  assetsLoading = signal(false);
  assetLibraryError = signal('');
  assetLibrary = signal<BusinessAssetLibraryItem[]>([]);
  activeAssetPicker = signal<string | null>(null);
  uploadingTargets = signal<Record<string, boolean>>({});
  private configId: string | null = null;
  readonly personalities = PREDEFINED_PERSONALITIES;
  readonly splitZones: Array<{
    id: SplitLayoutSlot;
    label: string;
    description: string;
  }> = [
    {
      id: 'primary',
      label: 'Primary column',
      description: 'Main narrative area for hero, about, and core selling sections.',
    },
    {
      id: 'secondary',
      label: 'Secondary column',
      description: 'Supporting proof, contact, and CTA sections.',
    },
  ];
  readonly gridZones: Array<{
    id: GridLayoutSlot;
    label: string;
    description: string;
  }> = [
    {
      id: 'hero-wide',
      label: 'Hero wide',
      description: 'A full-width lead slot across the top of the grid.',
    },
    {
      id: 'top-left',
      label: 'Top left',
      description: 'First supporting slot below the hero band.',
    },
    {
      id: 'top-right',
      label: 'Top right',
      description: 'Second supporting slot below the hero band.',
    },
    {
      id: 'bottom-left',
      label: 'Bottom left',
      description: 'Lower-left supporting slot.',
    },
    {
      id: 'bottom-right',
      label: 'Bottom right',
      description: 'Lower-right supporting slot.',
    },
  ];
  readonly layoutOptions = [
    {
      value: 'single-column' as const,
      label: 'Single column',
      description: 'A linear editorial flow for narrative-heavy landing pages.',
    },
    {
      value: 'split' as const,
      label: 'Split layout',
      description: 'Keeps the hero dominant while supporting content sits alongside it.',
    },
    {
      value: 'grid' as const,
      label: 'Grid layout',
      description: 'A denser modular presentation for services, proof, and calls to action.',
    },
  ];
  readonly motionOptions: Array<{ value: LandingSectionMotionKind; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'particle-veil', label: 'Particle Veil' },
    { value: 'parallax-grid-warp', label: 'Parallax Grid Warp' },
    { value: 'aurora-ribbon', label: 'Aurora Ribbon' },
    { value: 'glass-fog', label: 'Glass Fog' },
    { value: 'pulse-rings', label: 'Pulse Rings' },
    { value: 'signal-mesh', label: 'Signal Mesh' },
    { value: 'topographic-drift', label: 'Topographic Drift' },
    { value: 'shimmer-beam', label: 'Shimmer Beam' },
  ];
  draft = signal<BusinessSiteConfig>(cloneBusinessSiteConfig());

  private applyDraftTheme(): void {
    const theme = this.draft().theme;
    this.themeService.setTheme(theme.mode);
    this.themeService.setPrimaryColor(theme.primaryColor);
    void this.themeService.setPersonality(theme.personalityId);
  }

  constructor() {
    this.siteConfig.fetch().subscribe({
      next: (site) => {
        this.loading.set(false);
        this.configId = this.siteConfig.configId();
        this.draft.set(cloneBusinessSiteConfig(site));
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  addCredential(): void {
    this.draft.update((d) => {
      d.brand.credentials.push('');
      return d;
    });
  }

  removeCredential(index: number): void {
    this.draft.update((d) => {
      d.brand.credentials.splice(index, 1);
      return d;
    });
  }

  addSpecialization(): void {
    this.draft.update((d) => {
      d.brand.specializations.push('');
      return d;
    });
  }

  removeSpecialization(index: number): void {
    this.draft.update((d) => {
      d.brand.specializations.splice(index, 1);
      return d;
    });
  }

  addTestimonial(): void {
    this.draft.update((d) => {
      d.testimonials.push({ quote: '', clientName: '', clientDetail: '' });
      return d;
    });
  }

  removeTestimonial(index: number): void {
    this.draft.update((d) => {
      d.testimonials.splice(index, 1);
      return d;
    });
  }

  addService(): void {
    this.draft.update((d) => {
      d.services.push({
        id: `service-${Date.now()}-${d.services.length + 1}`,
        name: '',
        description: '',
        duration: 60,
        price: 0,
        allowOnlineBooking: true,
      });
      return d;
    });
  }

  removeService(index: number): void {
    this.draft.update((d) => {
      d.services.splice(index, 1);
      return d;
    });
  }

  addCapability(): void {
    this.draft.update((d) => {
      d.clientPortal.capabilities.push('');
      return d;
    });
  }

  removeCapability(index: number): void {
    this.draft.update((d) => {
      d.clientPortal.capabilities.splice(index, 1);
      return d;
    });
  }

  addCustomSection(): void {
    this.draft.update((draft) => {
      draft.landingPage.sections.push({
        id: `custom-${Date.now()}-${draft.landingPage.sections.length + 1}`,
        type: 'custom',
        title: 'Custom section',
        enabled: true,
        order: draft.landingPage.sections.length,
        body: '',
        ctaLabel: '',
        ctaHref: '',
        motion: this.createDefaultMotion(),
      });
      draft.landingPage.sections = normalizeLandingSections(draft.landingPage.sections);
      return draft;
    });
  }

  addImageSection(): void {
    this.draft.update((draft) => {
      draft.landingPage.sections.push({
        id: `image-${Date.now()}-${draft.landingPage.sections.length + 1}`,
        type: 'image',
        title: 'Image block',
        enabled: true,
        order: draft.landingPage.sections.length,
        image: this.createDefaultImage(),
        motion: this.createDefaultMotion(),
      });
      draft.landingPage.sections = normalizeLandingSections(draft.landingPage.sections);
      return draft;
    });
  }

  addGallerySection(): void {
    this.draft.update((draft) => {
      draft.landingPage.sections.push({
        id: `gallery-${Date.now()}-${draft.landingPage.sections.length + 1}`,
        type: 'gallery',
        title: 'Gallery block',
        enabled: true,
        order: draft.landingPage.sections.length,
        gallery: {
          style: 'grid',
          columns: 3,
          items: [this.createDefaultImage()],
        },
        motion: this.createDefaultMotion(),
      });
      draft.landingPage.sections = normalizeLandingSections(draft.landingPage.sections);
      return draft;
    });
  }

  addGalleryItem(sectionIndex: number): void {
    this.draft.update((draft) => {
      draft.landingPage.sections[sectionIndex].gallery?.items.push(this.createDefaultImage());
      return draft;
    });
  }

  removeGalleryItem(sectionIndex: number, itemIndex: number): void {
    this.draft.update((draft) => {
      draft.landingPage.sections[sectionIndex].gallery?.items.splice(itemIndex, 1);
      return draft;
    });
  }

  assetTargetKey(sectionIndex: number, itemIndex?: number | null): string {
    return itemIndex === null || itemIndex === undefined
      ? `section-${sectionIndex}`
      : `section-${sectionIndex}-item-${itemIndex}`;
  }

  isAssetPickerOpen(sectionIndex: number, itemIndex?: number | null): boolean {
    return this.activeAssetPicker() === this.assetTargetKey(sectionIndex, itemIndex);
  }

  isUploading(targetKey: string): boolean {
    return !!this.uploadingTargets()[targetKey];
  }

  toggleAssetPicker(sectionIndex: number, itemIndex?: number | null): void {
    const key = this.assetTargetKey(sectionIndex, itemIndex);
    if (this.activeAssetPicker() === key) {
      this.activeAssetPicker.set(null);
      return;
    }

    this.activeAssetPicker.set(key);
    void this.loadOwnerAssets();
  }

  async loadOwnerAssets(force = false): Promise<void> {
    if (!force && (this.assetsLoading() || this.assetLibrary().length)) {
      return;
    }

    const profileId = this.auth.user()?.profileId;
    if (!profileId) {
      this.assetLibraryError.set('Owner profile is not available for asset browsing.');
      return;
    }

    this.assetsLoading.set(true);
    this.assetLibraryError.set('');
    this.api.listAssets(profileId).subscribe({
      next: (assets) => {
        this.assetsLoading.set(false);
        this.assetLibrary.set(assets);
      },
      error: (err) => {
        this.assetsLoading.set(false);
        this.assetLibraryError.set(
          err?.error?.message || err?.message || 'Failed to load assets.'
        );
      },
    });
  }

  selectAsset(
    sectionIndex: number,
    itemIndex: number | null,
    asset: BusinessAssetLibraryItem
  ): void {
    this.draft.update((draft) => {
      if (itemIndex === null || itemIndex === undefined) {
        const image = draft.landingPage.sections[sectionIndex].image;
        if (image) {
          image.sourceType = 'asset';
          image.src = asset.url;
          image.alt = image.alt || asset.name;
        }
      } else {
        const image = draft.landingPage.sections[sectionIndex].gallery?.items[itemIndex];
        if (image) {
          image.sourceType = 'asset';
          image.src = asset.url;
          image.alt = image.alt || asset.name;
        }
      }
      return draft;
    });
    this.activeAssetPicker.set(null);
  }

  async onAssetFileSelected(
    sectionIndex: number,
    itemIndex: number | null,
    event: Event
  ): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    const profileId = this.auth.user()?.profileId;
    const targetKey = this.assetTargetKey(sectionIndex, itemIndex);
    if (!file || !profileId) {
      return;
    }

    this.uploadingTargets.update((state) => ({ ...state, [targetKey]: true }));
    this.assetLibraryError.set('');

    try {
      const assetUrl = await this.uploadAsset(file, profileId);
      this.draft.update((draft) => {
        if (itemIndex === null || itemIndex === undefined) {
          const image = draft.landingPage.sections[sectionIndex].image;
          if (image) {
            image.sourceType = 'asset';
            image.src = assetUrl;
            image.alt = image.alt || file.name.replace(/\.[^/.]+$/, '');
          }
        } else {
          const image = draft.landingPage.sections[sectionIndex].gallery?.items[itemIndex];
          if (image) {
            image.sourceType = 'asset';
            image.src = assetUrl;
            image.alt = image.alt || file.name.replace(/\.[^/.]+$/, '');
          }
        }
        return draft;
      });
      await this.loadOwnerAssets(true);
      this.activeAssetPicker.set(null);
    } catch (error: any) {
      this.assetLibraryError.set(
        error?.error?.message || error?.message || 'Asset upload failed.'
      );
    } finally {
      if (input) {
        input.value = '';
      }
      this.uploadingTargets.update((state) => ({ ...state, [targetKey]: false }));
    }
  }

  setLandingLayout(layout: BusinessSiteConfig['landingPage']['layout']): void {
    this.draft.update((draft) => {
      draft.landingPage.layout = layout;
      return draft;
    });
  }

  resetSectionOrder(): void {
    this.draft.update((draft) => {
      draft.landingPage.sections = normalizeLandingSections([...draft.landingPage.sections]);
      return draft;
    });
  }

  setAllSectionsEnabled(enabled: boolean): void {
    this.draft.update((draft) => {
      draft.landingPage.sections = draft.landingPage.sections.map((section) => ({
        ...section,
        enabled,
      }));
      return draft;
    });
  }

  restoreRecommendedSectionState(): void {
    const recommendedOrder = ['hero', 'about', 'services', 'testimonials', 'contact', 'booking'];
    this.draft.update((draft) => {
      const ordered = [...draft.landingPage.sections].sort((a, b) => {
        const indexA = recommendedOrder.indexOf(a.id);
        const indexB = recommendedOrder.indexOf(b.id);
        return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) -
          (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB);
      });
      draft.landingPage.sections = normalizeLandingSections(
        ordered.map((section) => ({
          ...section,
          enabled: recommendedOrder.includes(section.id) ? true : section.enabled,
        }))
      );
      return draft;
    });
  }

  connectedDropLists(): string[] {
    return [
      this.dropListId('single-column', 'main'),
      ...this.splitZones.map((zone) => this.dropListId('split', zone.id)),
      ...this.gridZones.map((zone) => this.dropListId('grid', zone.id)),
    ];
  }

  dropListId(layout: 'single-column' | 'split' | 'grid', zoneId: string): string {
    return `landing-${layout}-${zoneId}`;
  }

  sectionIdsForZone(
    layout: 'single-column' | 'split' | 'grid',
    zoneId: string
  ): string[] {
    return this.sectionsForZone(layout, zoneId).map((section) => section.id);
  }

  sectionsForZone(
    layout: 'single-column' | 'split' | 'grid',
    zoneId: string
  ) {
    const sections = [...this.draft().landingPage.sections];
    if (layout === 'single-column') {
      return sections.sort((a, b) => a.order - b.order);
    }

    return sections
      .filter((section) =>
        layout === 'split'
          ? (section.layoutPlacement?.split ?? this.defaultSplitSlot(section.id)) === zoneId
          : (section.layoutPlacement?.grid ?? this.defaultGridSlot(section.id)) === zoneId
      )
      .sort((a, b) => a.order - b.order);
  }

  moveSectionToLayoutZone(
    sectionId: string,
    layout: 'split' | 'grid',
    zoneId: SplitLayoutSlot | GridLayoutSlot
  ): void {
    const sections = [...this.draft().landingPage.sections];
    const target = sections.find((section) => section.id === sectionId);
    if (!target) {
      return;
    }

    if (layout === 'split') {
      target.layoutPlacement = {
        ...(target.layoutPlacement ?? {}),
        split: zoneId as SplitLayoutSlot,
      };
    } else {
      target.layoutPlacement = {
        ...(target.layoutPlacement ?? {}),
        grid: zoneId as GridLayoutSlot,
      };
    }

    this.draft.update((draft) => {
      draft.landingPage.sections = normalizeLandingSections(sections);
      return draft;
    });
  }

  dropSection(
    event: CdkDragDrop<string[]>,
    layout: 'single-column' | 'split' | 'grid',
    zoneId: string
  ): void {
    const zoneMap = this.buildZoneSectionMap(layout);
    const previousZoneId = this.zoneIdFromDropListId(event.previousContainer.id);
    const targetZoneId = this.zoneIdFromDropListId(event.container.id) ?? zoneId;
    if (!previousZoneId || !targetZoneId) {
      return;
    }

    const previousItems = [...(zoneMap.get(previousZoneId) ?? [])];
    const targetItems =
      previousZoneId === targetZoneId
        ? previousItems
        : [...(zoneMap.get(targetZoneId) ?? [])];

    if (event.previousContainer === event.container) {
      moveItemInArray(targetItems, event.previousIndex, event.currentIndex);
      zoneMap.set(targetZoneId, targetItems);
    } else {
      transferArrayItem(
        previousItems,
        targetItems,
        event.previousIndex,
        event.currentIndex
      );
      zoneMap.set(previousZoneId, previousItems);
      zoneMap.set(targetZoneId, targetItems);
    }

    this.applyZoneSectionMap(layout, zoneMap);
  }

  toggleSectionEnabled(sectionId: string, enabled: boolean): void {
    this.draft.update((draft) => {
      draft.landingPage.sections = draft.landingPage.sections.map((section) =>
        section.id === sectionId ? { ...section, enabled } : section
      );
      return draft;
    });
  }

  removeSection(index: number): void {
    this.draft.update((draft) => {
      draft.landingPage.sections.splice(index, 1);
      draft.landingPage.sections = normalizeLandingSections(draft.landingPage.sections);
      return draft;
    });
  }

  moveSectionUp(index: number): void {
    if (index <= 0) {
      return;
    }

    this.draft.update((draft) => {
      const sections = [...draft.landingPage.sections];
      [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
      draft.landingPage.sections = normalizeLandingSections(sections);
      return draft;
    });
  }

  moveSectionDown(index: number): void {
    if (index >= this.draft().landingPage.sections.length - 1) {
      return;
    }

    this.draft.update((draft) => {
      const sections = [...draft.landingPage.sections];
      [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
      draft.landingPage.sections = normalizeLandingSections(sections);
      return draft;
    });
  }

  sectionDescription(sectionType: string): string {
    switch (sectionType) {
      case 'hero':
        return 'Lead with brand positioning, owner identity, and the first call to action.';
      case 'about':
        return 'Expand on the owner voice and give visitors more confidence about fit.';
      case 'services':
        return 'Surface core offers and explain how each engagement starts.';
      case 'testimonials':
        return 'Add social proof and credibility without interrupting the main flow.';
      case 'contact':
        return 'Make direct contact details and next steps easy to find.';
      case 'booking':
        return 'Keep a dedicated conversion block for booking-ready visitors.';
      case 'custom':
        return 'Insert a flexible proof, FAQ, process, or CTA section anywhere in the sequence.';
      case 'image':
        return 'Drop in a single image block with captioning, aspect control, and optional motion.';
      case 'gallery':
        return 'Use a multi-image block for proof, behind-the-scenes visuals, or portfolio snapshots.';
      default:
        return 'Control whether this section appears and where it sits in the public narrative.';
    }
  }

  sectionSummary(section: LandingSection): string {
    if (section.type === 'custom') {
      return section.body?.trim() || 'Add supporting copy and an optional CTA.';
    }

    if (section.type === 'image') {
      return section.image?.src?.trim()
        ? `${section.image.sourceType === 'asset' ? 'Asset' : 'URL'} image with ${section.image.aspect ?? 'landscape'} framing.`
        : 'No image source selected yet.';
    }

    if (section.type === 'gallery') {
      const count = section.gallery?.items?.filter((item) => item.src.trim()).length ?? 0;
      return count
        ? `${count} gallery image${count === 1 ? '' : 's'} in a ${section.gallery?.style ?? 'grid'} layout.`
        : 'No gallery images selected yet.';
    }

    return this.sectionDescription(section.type);
  }

  sectionPreviewImage(section: LandingSection): LandingSectionMediaItem | null {
    if (section.type === 'image' && section.image?.src?.trim()) {
      return section.image;
    }

    if (section.type === 'gallery') {
      return section.gallery?.items.find((item) => item.src.trim()) ?? null;
    }

    return null;
  }

  motionLabel(kind: LandingSectionMotionKind): string {
    return this.motionOptions.find((option) => option.value === kind)?.label ?? 'Motion';
  }

  private buildZoneSectionMap(layout: 'single-column' | 'split' | 'grid'): Map<string, string[]> {
    const zones =
      layout === 'single-column'
        ? ['main']
        : layout === 'split'
          ? this.splitZones.map((zone) => zone.id)
          : this.gridZones.map((zone) => zone.id);
    return new Map(
      zones.map((zoneId) => [zoneId, this.sectionIdsForZone(layout, zoneId)])
    );
  }

  private applyZoneSectionMap(
    layout: 'single-column' | 'split' | 'grid',
    zoneMap: Map<string, string[]>
  ): void {
    const sectionsById = new Map(
      this.draft().landingPage.sections.map((section) => [section.id, { ...section }])
    );
    const zoneOrder =
      layout === 'single-column'
        ? ['main']
        : layout === 'split'
          ? this.splitZones.map((zone) => zone.id)
          : this.gridZones.map((zone) => zone.id);

    const nextSections = zoneOrder.flatMap((zoneId) =>
      (zoneMap.get(zoneId) ?? [])
        .map((sectionId) => {
          const section = sectionsById.get(sectionId);
          if (!section) {
            return null;
          }

          if (layout === 'split') {
            section.layoutPlacement = {
              ...(section.layoutPlacement ?? {}),
              split: zoneId as SplitLayoutSlot,
            };
          } else if (layout === 'grid') {
            section.layoutPlacement = {
              ...(section.layoutPlacement ?? {}),
              grid: zoneId as GridLayoutSlot,
            };
          }

          return section;
        })
        .filter((section): section is NonNullable<typeof section> => !!section)
    );

    this.draft.update((draft) => {
      draft.landingPage.sections = normalizeLandingSections(nextSections);
      return draft;
    });
  }

  private zoneIdFromDropListId(dropListId: string): string | null {
    return dropListId.split('-').slice(2).join('-') || null;
  }

  private defaultSplitSlot(sectionId: string): SplitLayoutSlot {
    return (
      this.draft().landingPage.sections.find((section) => section.id === sectionId)?.layoutPlacement
        ?.split ?? (['hero', 'about', 'services'].includes(sectionId) ? 'primary' : 'secondary')
    );
  }

  private defaultGridSlot(sectionId: string): GridLayoutSlot {
    return (
      this.draft().landingPage.sections.find((section) => section.id === sectionId)?.layoutPlacement
        ?.grid ??
      ({
        hero: 'hero-wide',
        about: 'top-left',
        services: 'top-right',
        testimonials: 'bottom-left',
        contact: 'bottom-right',
        booking: 'bottom-right',
      } as Record<string, GridLayoutSlot>)[sectionId] ??
      'bottom-right'
    );
  }

  private createDefaultImage(): LandingSectionMediaItem {
    return {
      sourceType: 'url',
      src: '',
      alt: '',
      caption: '',
      aspect: 'landscape',
      fit: 'cover',
      focalPoint: 'center',
    };
  }

  private createDefaultMotion() {
    return {
      kind: 'none' as LandingSectionMotionKind,
      density: 18,
      speed: 1,
      intensity: 0.65,
      height: '100%',
      reducedMotion: false,
      direction: 'diagonal' as const,
      ringCount: 4,
    };
  }

  private async uploadAsset(file: File, profileId: string): Promise<string> {
    const content = await this.fileToBase64(file);
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const payload: AssetUploadPayload = {
      name: file.name.replace(/\.[^/.]+$/, ''),
      profileId,
      type: 'image',
      content,
      fileExtension,
    };
    const asset = await firstValueFrom(
      this.http.post<{ id: string }>('/api/asset', payload, {
        headers: this.auth.getAuthHeaders(),
      })
    );
    return `/api/asset/${asset.id}`;
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private sanitizedDraft(): BusinessSiteConfig {
    const draft = cloneBusinessSiteConfig(this.draft());

    draft.brand.ownerName = draft.brand.ownerName?.trim() || draft.brand.trainerName || 'Business Owner';
    draft.brand.trainerName = draft.brand.trainerName?.trim() || draft.brand.ownerName;

    if (!draft.features.booking.enabled) {
      draft.features.booking.allowOnlinePayment = false;
    }

    if (!draft.features.clientTasks.enabled) {
      draft.features.clientTasks.allowClientCompletion = false;
    }

    draft.landingPage.sections = normalizeLandingSections(
      [...draft.landingPage.sections]
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
          ...section,
          title: section.title.trim() || 'Untitled section',
          body: section.body?.trim(),
          ctaLabel: section.ctaLabel?.trim(),
          ctaHref: section.ctaHref?.trim(),
          image: section.image
            ? {
                ...section.image,
                src: section.image.src.trim(),
                alt: section.image.alt.trim(),
                caption: section.image.caption?.trim(),
              }
            : undefined,
          gallery: section.gallery
            ? {
                ...section.gallery,
                items: section.gallery.items.map((item) => ({
                  ...item,
                  src: item.src.trim(),
                  alt: item.alt.trim(),
                  caption: item.caption?.trim(),
                })),
              }
            : undefined,
        }))
    );

    return draft;
  }

  save(): void {
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');
    const payload = this.sanitizedDraft();

    this.api
      .updateSiteConfig(this.configId, payload)
      .subscribe({
        next: (saved: any) => {
          this.saving.set(false);
          if (saved?.id && this.configId === null) {
            this.configId = saved.id;
          }
          this.draft.set(payload);
          this.siteConfig.setSite(payload, this.configId);
          this.applyDraftTheme();
          this.successMsg.set('Site content saved successfully.');
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMsg.set(
            err?.error?.message || err?.message || 'Save failed. Please try again.'
          );
        },
      });
  }

  reset(): void {
    this.draft.set(cloneBusinessSiteConfig());
    this.successMsg.set('');
    this.errorMsg.set('');
  }
}
