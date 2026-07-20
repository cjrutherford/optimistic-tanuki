# **MetroCast: Product Requirements Document (PRD)**

## **1\. Project Vision**

MetroCast is a hyper-local, geofenced streaming network that replicates the over-the-air (OTA) feel of traditional radio and television. It bridges the gap between active creator content and passive local discovery.

## **2\. Epics & User Stories**

### **Epic 1: The Linear Broadcast Engine (The "Cold Start" Solution)**

_Goal: Ensure there is always content playing to maintain the OTA feel._

- **User Story:** As a creator, I want to define a schedule of live streams, reruns, and ads so that my channel never has "dead air."
- **Deliverables:**
  - SchedulerWorker: A background job in NestJS that manages the playlist state per channel.
  - PlaylistGenerator: Logic to inject ad-breaks and reruns based on priority.
- **Feature Set:** 24/7 automated HLS playback loop with dynamic content insertion.

### **Epic 2: Geospatial Routing & Discovery**

\*Goal: Enforce locality for all interactions using PostGIS.

- **User Story:** As a viewer, I want to see only the local content and businesses within my immediate physical radius.
- **Deliverables:**
  - SpatialRepository: NestJS-PostGIS interface for ST_DWithin and ST_Covers.
  - GeofenceController: API endpoints that validate user location before dispensing channel access.
- **Feature Set:** Real-time stream discovery and business discovery mapped to user GPS.

### **Epic 3: Real-Time Media & Handoff**

\*Goal: Provide sub-second latency for live interaction while utilizing standard streaming for passive content.

- **User Story:** As a viewer, I want the player to switch seamlessly from a passive HLS broadcast to a live WebRTC interaction without reloading.
- **Deliverables:**
  - DualPlayerComponent: An Angular wrapper managing both HLS.js and LiveKit-client.
  - MediaAuthService: NestJS logic to mint secure, location-bound LiveKit JWTs.
- **Feature Set:** Automatic HLS-to-WebRTC transition when a channel status changes from SCHEDULED to LIVE.

### **Epic 4: Monetization & Ad Portal**

\*Goal: Integrate local commercial breaks into the linear broadcast.

- **User Story:** As a business, I want to upload a video ad and define a geographic polygon where that ad should be injected.
- **Deliverables:**
  - AdPortalDashboard: UI for businesses to define polygons and upload assets.
  - AdInjectionEngine: Logic to insert ad-blobs into the 24/7 HLS stream.
- **Feature Set:** Targeted, polygon-matched localized advertising.

### **Epic 5: Proof of Locality & Gamification**

\*Goal: Prevent spoofing and drive real-world foot traffic.

- **User Story:** As a local business, I want to gamify visits via QR codes to prove customer location and boost traffic.
- **Deliverables:**
  - QrVerificationService: Backend service to sign/refresh rotating QR codes.
  - TelemetryValidator: NestJS middleware checking for "Impossible Travel" and GPS noise signatures.
- **Feature Set:** Cryptographic QR check-ins and "Reputation Score" boosting.

## **3\. Monorepo Structure**

### **/apps**

- web-tuner: Angular PWA for passive consumers.
- creator-studio: Angular app for channel management and stream hosting.
- api-gateway: NestJS application handling business logic and PostGIS routing.

### **/libs**

- common-ui: Shared design atoms.
- media-composites: DualPlayerComponent, stream status overlays.
- spatial-logic: Typescript wrappers for PostGIS raw queries.
- auth-tokens: JWT logic for LiveKit/Session management.
- geo-utils: Telemetry noise analysis, IP-to-Geo validation, and velocity calc.

## **4\. Conceptual Prototypes**

### **Prototype A: The Tuner Handoff (Angular)**

The DualPlayer tracks a ChannelState (IDLE, PLAYING_HLS, LIVE_RTC).

- **If State is PLAYING_HLS:** The player renders a standard HLS video element.
- **If State changes to LIVE_RTC:** The player triggers a connect() to the LiveKit socket using the validated JWT and attaches the track to a new video element, overlaying it on top of the HLS container before destroying the HLS instance.

### **Prototype B: The Spatial Ad-Injection (PostGIS)**

When the scheduler builds the playlist, it queries:

SELECT ad_url FROM ads  
WHERE ST_Intersects(ad_polygon, creator_broadcast_polygon)  
ORDER BY bid_price DESC LIMIT 1;

This ensures the business advertiser and the creator's channel signal are physically aligned before the ad is queued in the linear stream.
