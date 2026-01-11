# Player Component: Angular Implementation Recommendations

This spec analyzes the player UI in `swiper-card-music-player.html` and recommends a configurable player component for audio and video content in the `common-ui` library.

---

## 1. **Player Component**

### **Effect**
- Modern player UI with glassmorphism background, controls, progress bar, volume, and playlist.
- Supports both audio and video playback.

### **Angular Implementation**

#### **A. New Component: `PlayerComponent`**
- **Location:** `libs/common-ui/src/lib/player/`
- **Inputs:**
  - `type: 'audio' | 'video'` (player mode)
  - `sources: MediaSource[]` (array of media sources)
  - `playlist: PlaylistItem[]` (optional, for playlist support)
  - `options: PlayerOptions` (see below)
- **Outputs:**
  - `play: EventEmitter<void>`
  - `pause: EventEmitter<void>`
  - `next: EventEmitter<void>`
  - `prev: EventEmitter<void>`
  - `seek: EventEmitter<number>`
  - `volumeChange: EventEmitter<number>`
- **Features:**
  - Glass effect background using glass effect utilities.
  - Responsive controls for play/pause, next/prev, shuffle, volume, and progress.
  - Playlist display and selection.
  - Like/favorite button support.
  - Configurable for audio or video content.

**Sample Usage:**
```html
<common-ui-player
  [type]="'audio'"
  [sources]="audioSources"
  [playlist]="playlistItems"
  [options]="playerOptions"
  (play)="onPlay()"
  (pause)="onPause()"
  (next)="onNext()"
  (prev)="onPrev()"
  (seek)="onSeek($event)"
  (volumeChange)="onVolumeChange($event)"
></common-ui-player>
```

#### **B. Player Options Interface**

```typescript
export interface PlayerOptions {
  glassEffect?: boolean;
  showPlaylist?: boolean;
  showVolume?: boolean;
  showProgress?: boolean;
  showLike?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  [key: string]: any;
}

export interface MediaSource {
  src: string;
  type: string; // 'audio/mpeg', 'video/mp4', etc.
}

export interface PlaylistItem {
  title: string;
  artist?: string;
  duration?: string;
  image?: string;
  src: string;
  liked?: boolean;
}
```

#### **C. Enhancement: Add Glass Effect Option**
- Use `GlassEffectDirective` or SCSS mixin for player background.

---

## 2. **Accessibility & Responsiveness**

- Keyboard accessible controls.
- Responsive layout for mobile and desktop.
- Alt text for images and ARIA labels for controls.

---

## 3. **Theme Integration**

- Add player theme variables to global theme files.
- Document usage in Storybook.

---

## **Next Steps**

1. Scaffold `PlayerComponent` in `common-ui`.
2. Implement glass effect background using directive/mixin.
3. Add support for audio/video, playlist, and all controls.
4. Add documentation

---

## **Deliverables Checklist**

- [ ] Scaffold `PlayerComponent` in `libs/common-ui/src/lib/player/`
- [ ] Implement configurable inputs and outputs for audio/video, sources, playlist, and options
- [ ] Add glass effect background using directive or SCSS mixin
- [ ] Build responsive player controls: play/pause, next/prev, shuffle, volume, progress
- [ ] Integrate playlist display and selection functionality
- [ ] Add like/favorite button support
- [ ] Ensure accessibility: keyboard controls, ARIA labels, alt text
- [ ] Make layout responsive for mobile and desktop
- [ ] Integrate theme support: light/dark/auto, global theme variables
- [ ] Document component usage and options in Storybook
- [ ] Provide sample usage and API documentation