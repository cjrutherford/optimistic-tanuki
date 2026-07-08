import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, interval, switchMap, takeUntil, tap, startWith } from 'rxjs';
import {
  AudioWorkstationService,
  AudioProject,
  Track,
  GenerationRequest,
  MixSnapshot,
} from '../../services/audio-workstation.service';

type CollaborationMode = 'full-auto' | 'cover' | 'full-collab';
type ActiveAgent = 'compose' | 'mix' | 'master';

interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

@Component({
  selector: 'orch-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="workspace">
      <!-- Top Bar -->
      <header class="top-bar">
        <a class="back-link" routerLink="/">← Projects</a>
        <h2>{{ project()?.name || 'Loading...' }}</h2>
        <div class="project-meta">
          <span *ngIf="project()?.bpm">{{ project()?.bpm }} BPM</span>
          <span *ngIf="project()?.key">{{ project()?.key }}</span>
        </div>
        <button
          class="btn-export"
          (click)="showExportDialog = true"
          [disabled]="!tracks().length"
        >
          Export
        </button>
      </header>

      <!-- Main 3-Column Layout -->
      <div class="workspace-body">
        <!-- Left: Stem Grid -->
        <aside class="panel stem-panel">
          <div class="panel-header">
            <h3>Stems</h3>
            <button
              class="btn-add"
              (click)="showGeneratePanel = !showGeneratePanel"
            >
              + Generate
            </button>
          </div>

          <!-- Collaboration Mode + Generation Panel -->
          <div class="generate-panel" *ngIf="showGeneratePanel">
            <h4>New Generation</h4>

            <!-- Mode Selector -->
            <div class="mode-selector">
              <button
                class="mode-btn"
                [class.active]="generationMode === 'full-auto'"
                (click)="generationMode = 'full-auto'"
              >
                <span class="mode-icon">🎯</span>
                <span>Full Auto</span>
              </button>
              <button
                class="mode-btn"
                [class.active]="generationMode === 'cover'"
                (click)="generationMode = 'cover'"
              >
                <span class="mode-icon">🎤</span>
                <span>Cover</span>
              </button>
              <button
                class="mode-btn"
                [class.active]="generationMode === 'full-collab'"
                (click)="generationMode = 'full-collab'"
              >
                <span class="mode-icon">🤝</span>
                <span>Full Collab</span>
              </button>
            </div>

            <!-- Mode-specific UI -->
            <div class="mode-description">
              <p *ngIf="generationMode === 'full-auto'">
                <strong>AI handles everything.</strong> Describe the music you
                want, and we'll generate a complete track from composition
                through mastering.
              </p>
              <p *ngIf="generationMode === 'cover'">
                <strong>Your voice, AI's arrangement.</strong> Provide vocals or
                a reference track, and we'll build a custom instrumental around
                you.
              </p>
              <p *ngIf="generationMode === 'full-collab'">
                <strong>You're in control.</strong> The AI suggests options and
                fills gaps, but every creative decision goes through you.
              </p>
            </div>

            <!-- Prompt Input -->
            <textarea
              [(ngModel)]="generationPrompt"
              placeholder="Describe the music you want to create..."
              class="prompt-input"
              rows="3"
            ></textarea>

            <div class="generation-params">
              <input
                [(ngModel)]="generationBpm"
                type="number"
                placeholder="BPM"
                class="param-input"
              />
              <input
                [(ngModel)]="generationKey"
                placeholder="Key"
                class="param-input small"
              />
              <select [(ngModel)]="generationGenre" class="param-input">
                <option value="">Genre</option>
                <option>Pop</option>
                <option>Rock</option>
                <option>Electronic</option>
                <option>Hip Hop</option>
                <option>Ambient</option>
              </select>
              <select [(ngModel)]="generationMood" class="param-input">
                <option value="">Mood</option>
                <option>Energetic</option>
                <option>Melancholic</option>
                <option>Relaxed</option>
                <option>Dark</option>
                <option>Uplifting</option>
              </select>
            </div>

            <!-- Cover Mode: Upload -->
            <div class="upload-section" *ngIf="generationMode === 'cover'">
              <span>Upload your vocal recording or reference track:</span>
              <input
                type="file"
                accept="audio/*"
                (change)="onFileSelected($event)"
              />
            </div>

            <button
              class="btn-generate"
              (click)="startGeneration()"
              [disabled]="isGenerating || !generationPrompt.trim()"
            >
              {{ isGenerating ? 'Generating...' : 'Generate' }}
            </button>

            <!-- Generation Progress -->
            <div class="generation-progress" *ngIf="isGenerating">
              <div class="progress-bar">
                <div class="progress-fill"></div>
              </div>
              <p class="progress-text">AI agents composing your track...</p>
            </div>
          </div>

          <!-- Stem List -->
          <div class="stem-list">
            <div
              class="stem-card"
              *ngFor="let track of tracks(); let i = index"
              [class.selected]="selectedTrackId === track.id"
              (click)="selectTrack(track)"
            >
              <div class="stem-header">
                <span
                  class="stem-type-badge"
                  [style.background]="trackColor(track.type)"
                  >{{ track.type }}</span
                >
                <span class="stem-name">{{ track.name }}</span>
              </div>
              <!-- Waveform placeholder -->
              <div class="waveform-preview">
                <div
                  class="waveform-bar"
                  *ngFor="let bar of [].constructor(40); let j = index"
                  [style.height.%]="30 + Math.abs(Math.sin(j * 0.5 + i)) * 50"
                ></div>
              </div>
              <div class="stem-controls">
                <button
                  class="ctrl-btn"
                  [class.active]="!track.muted"
                  (click)="toggleMute(track)"
                >
                  {{ track.muted ? 'M' : 'S' }}
                </button>
                <button
                  class="ctrl-btn"
                  [class.active]="track.solo"
                  (click)="toggleSolo(track)"
                >
                  {{ track.solo ? 'S' : 'O' }}
                </button>
                <input
                  type="range"
                  min="-60"
                  max="12"
                  [value]="track.volume"
                  (input)="updateVolume(track, $event)"
                  class="volume-slider"
                />
                <span class="db-label">{{ track.volume }}dB</span>
              </div>
            </div>
            <div
              class="empty-stems"
              *ngIf="tracks().length === 0 && !isGenerating"
            >
              <p>No stems yet. Click "+ Generate" to start creating.</p>
            </div>
          </div>
        </aside>

        <!-- Center: Arrangement / Mix Console -->
        <main class="panel main-panel">
          <div class="panel-header">
            <h3>
              {{
                selectedTab === 'arrangement' ? 'Arrangement' : 'Mix Console'
              }}
            </h3>
            <div class="tab-switcher">
              <button
                [class.active]="selectedTab === 'arrangement'"
                (click)="selectedTab = 'arrangement'"
              >
                Arrangement
              </button>
              <button
                [class.active]="selectedTab === 'mix'"
                (click)="selectedTab = 'mix'"
              >
                Mix
              </button>
            </div>
          </div>

          <!-- Arrangement View -->
          <div class="arrangement-view" *ngIf="selectedTab === 'arrangement'">
            <div class="arrangement-sections">
              <div
                class="section-block"
                *ngFor="let section of arrangementSections"
              >
                <span class="section-label">{{ section.label }}</span>
                <span class="section-bars">{{ section.bars }} bars</span>
              </div>
            </div>
            <div
              class="timeline-empty"
              *ngIf="arrangementSections.length === 0"
            >
              <p>Generate music to see the arrangement structure here.</p>
            </div>
          </div>

          <!-- Mix Console -->
          <div class="mix-console" *ngIf="selectedTab === 'mix'">
            <div class="mix-channel" *ngFor="let track of tracks()">
              <span class="channel-name">{{ track.name }}</span>
              <div class="channel-fader">
                <label>Vol</label>
                <input
                  type="range"
                  min="-60"
                  max="12"
                  orient="vertical"
                  [value]="track.volume"
                  (input)="updateVolume(track, $event)"
                />
              </div>
              <div class="channel-pan">
                <label>Pan</label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  [value]="track.pan"
                  (input)="updatePan(track, $event)"
                />
              </div>
            </div>
            <div class="mix-empty" *ngIf="tracks().length === 0">
              <p>No tracks to mix yet.</p>
            </div>
          </div>
        </main>

        <!-- Right: Agent Chat -->
        <aside class="panel chat-panel">
          <div class="panel-header">
            <h3>AI Agents</h3>
            <div class="agent-tabs">
              <button
                *ngFor="let agent of activeAgents"
                [class.active]="currentAgent === agent"
                (click)="switchAgent(agent)"
              >
                {{
                  agent === 'compose'
                    ? 'Composer'
                    : agent === 'mix'
                    ? 'Mix'
                    : 'Master'
                }}
              </button>
            </div>
          </div>

          <div class="chat-messages" #chatContainer>
            <div
              class="message"
              *ngFor="let msg of chatMessages()"
              [class.user]="msg.role === 'user'"
              [class.agent]="msg.role === 'agent'"
            >
              <div class="msg-avatar">
                {{ msg.role === 'user' ? '👤' : '🤖' }}
              </div>
              <div class="msg-content">
                <p>{{ msg.text }}</p>
                <span class="msg-time">{{
                  msg.timestamp | date : 'HH:mm'
                }}</span>
              </div>
            </div>

            <!-- Typing indicator -->
            <div class="message agent" *ngIf="agentIsThinking">
              <div class="msg-avatar">🤖</div>
              <div class="msg-content">
                <p class="typing-indicator">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </p>
              </div>
            </div>
          </div>

          <div class="chat-input">
            <div class="suggested-commands" *ngIf="!chatMessages().length">
              <button
                *ngFor="let cmd of suggestedCommands"
                (click)="sendChatMessage(cmd)"
              >
                {{ cmd }}
              </button>
            </div>
            <div class="input-row">
              <input
                [(ngModel)]="chatInput"
                (keyup.enter)="sendChatMessage(chatInput)"
                placeholder="Ask the agent..."
                class="chat-text-input"
              />
              <button
                class="btn-send"
                (click)="sendChatMessage(chatInput)"
                [disabled]="!chatInput.trim()"
              >
                Send
              </button>
            </div>
          </div>
        </aside>
      </div>

      <!-- Transport Bar -->
      <footer class="transport-bar">
        <button class="transport-btn" (click)="playPause()">▶</button>
        <button class="transport-btn" (click)="stopPlayback()">■</button>
        <div class="position-slider">
          <input type="range" min="0" max="100" class="seek-bar" />
          <span class="time-display">0:00 / 0:00</span>
        </div>
        <div class="master-volume">
          <label>Master</label>
          <input type="range" min="-60" max="12" value="0" />
        </div>
      </footer>

      <!-- Export Dialog -->
      <div
        class="modal-overlay"
        *ngIf="showExportDialog"
        (click)="showExportDialog = false"
      >
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Export</h3>
          <div class="export-options">
            <label
              >Format:
              <select [(ngModel)]="exportFormat">
                <option value="wav">WAV</option>
                <option value="mp3">MP3</option>
                <option value="flac">FLAC</option>
              </select>
            </label>
            <label
              >Quality:
              <select [(ngModel)]="exportQuality">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="exportIncludeStems" />
              Include individual stems
            </label>
          </div>
          <div class="modal-actions">
            <button class="btn-primary" (click)="doExport()">Export</button>
            <button class="btn-secondary" (click)="showExportDialog = false">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .workspace {
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: #0d0d0d;
        color: #e0e0e0;
      }
      .top-bar {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1rem;
        background: #1a1a1a;
        border-bottom: 1px solid #333;
      }
      .top-bar h2 {
        flex: 1;
        margin: 0;
        font-size: 1.1rem;
      }
      .top-bar a {
        color: #888;
        text-decoration: none;
      }
      .project-meta {
        display: flex;
        gap: 0.5rem;
        font-size: 0.8rem;
        color: #666;
      }
      .btn-export {
        background: #2d2d2d;
        color: #ccc;
        border: 1px solid #555;
        border-radius: 6px;
        padding: 0.4rem 1rem;
        cursor: pointer;
      }
      .btn-export:disabled {
        opacity: 0.5;
      }
      .workspace-body {
        flex: 1;
        display: grid;
        grid-template-columns: 320px 1fr 320px;
        overflow: hidden;
      }
      .panel {
        display: flex;
        flex-direction: column;
        border-right: 1px solid #222;
        overflow: hidden;
      }
      .panel:last-child {
        border-right: none;
      }
      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #222;
      }
      .panel-header h3 {
        margin: 0;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #888;
      }
      .btn-add {
        background: transparent;
        color: #6c5ce7;
        border: 1px solid #6c5ce7;
        border-radius: 6px;
        padding: 0.3rem 0.75rem;
        cursor: pointer;
        font-size: 0.8rem;
      }

      /* Generation Panel */
      .generate-panel {
        padding: 1rem;
        border-bottom: 1px solid #222;
      }
      .generate-panel h4 {
        margin: 0 0 0.75rem;
        font-size: 0.9rem;
      }
      .mode-selector {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }
      .mode-btn {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        padding: 0.5rem;
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 8px;
        color: #888;
        cursor: pointer;
        font-size: 0.7rem;
      }
      .mode-btn.active {
        border-color: #6c5ce7;
        color: #6c5ce7;
        background: #1a1a2e;
      }
      .mode-icon {
        font-size: 1.2rem;
      }
      .mode-description p {
        font-size: 0.75rem;
        color: #888;
        line-height: 1.4;
        margin: 0 0 0.75rem;
      }
      .prompt-input {
        width: 100%;
        background: #222;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 0.75rem;
        color: #e0e0e0;
        resize: vertical;
        font-family: inherit;
        font-size: 0.85rem;
        margin-bottom: 0.75rem;
      }
      .generation-params {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        flex-wrap: wrap;
      }
      .param-input {
        background: #222;
        border: 1px solid #444;
        border-radius: 6px;
        padding: 0.4rem;
        color: #e0e0e0;
        font-size: 0.8rem;
        flex: 1;
        min-width: 60px;
      }
      .param-input.small {
        max-width: 60px;
      }
      .upload-section {
        margin-bottom: 0.75rem;
        font-size: 0.8rem;
      }
      .upload-section span {
        display: block;
        margin-bottom: 0.35rem;
        color: #888;
      }
      .upload-section input {
        font-size: 0.8rem;
      }
      .btn-generate {
        width: 100%;
        background: #6c5ce7;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 0.6rem;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .btn-generate:disabled {
        opacity: 0.5;
      }
      .generation-progress {
        margin-top: 0.75rem;
      }
      .progress-bar {
        height: 4px;
        background: #333;
        border-radius: 2px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        width: 100%;
        background: #6c5ce7;
        animation: progress 3s ease-in-out infinite;
      }
      @keyframes progress {
        0% {
          width: 0%;
        }
        100% {
          width: 100%;
        }
      }
      .progress-text {
        font-size: 0.75rem;
        color: #888;
        margin-top: 0.35rem;
      }

      /* Stem List */
      .stem-list {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem;
      }
      .stem-card {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        cursor: pointer;
      }
      .stem-card.selected {
        border-color: #6c5ce7;
      }
      .stem-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }
      .stem-type-badge {
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.7rem;
        text-transform: uppercase;
        color: #fff;
      }
      .stem-name {
        font-size: 0.85rem;
      }
      .waveform-preview {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 32px;
        margin-bottom: 0.5rem;
      }
      .waveform-bar {
        flex: 1;
        background: #6c5ce7;
        opacity: 0.5;
        border-radius: 1px;
        min-height: 4px;
      }
      .stem-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .ctrl-btn {
        width: 28px;
        height: 28px;
        border-radius: 4px;
        border: 1px solid #555;
        background: transparent;
        color: #888;
        font-size: 0.7rem;
        cursor: pointer;
        font-weight: bold;
      }
      .ctrl-btn.active {
        background: #6c5ce7;
        color: #fff;
        border-color: #6c5ce7;
      }
      .volume-slider {
        flex: 1;
      }
      .db-label {
        font-size: 0.7rem;
        color: #888;
        min-width: 40px;
      }
      .empty-stems {
        padding: 2rem;
        text-align: center;
        color: #666;
        font-size: 0.85rem;
      }

      /* Main Panel */
      .main-panel {
        flex: 1;
      }
      .tab-switcher {
        display: flex;
        gap: 0.25rem;
      }
      .tab-switcher button {
        background: transparent;
        border: none;
        color: #666;
        padding: 0.25rem 0.75rem;
        cursor: pointer;
        font-size: 0.8rem;
        border-radius: 4px;
      }
      .tab-switcher button.active {
        background: #333;
        color: #fff;
      }
      .arrangement-view,
      .mix-console {
        flex: 1;
        padding: 1rem;
        overflow-y: auto;
      }
      .arrangement-sections {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .section-block {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 1rem;
        min-width: 100px;
        text-align: center;
      }
      .section-label {
        display: block;
        font-size: 0.85rem;
        color: #fff;
        margin-bottom: 0.25rem;
      }
      .section-bars {
        font-size: 0.75rem;
        color: #888;
      }
      .timeline-empty,
      .mix-empty {
        padding: 2rem;
        text-align: center;
        color: #666;
      }
      .mix-channel {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid #222;
      }
      .channel-name {
        min-width: 80px;
        font-size: 0.85rem;
      }
      .channel-fader,
      .channel-pan {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
      }
      .channel-fader label,
      .channel-pan label {
        font-size: 0.65rem;
        color: #666;
        text-transform: uppercase;
      }

      /* Chat Panel */
      .chat-panel {
        display: flex;
        flex-direction: column;
      }
      .agent-tabs {
        display: flex;
        gap: 0.25rem;
      }
      .agent-tabs button {
        background: transparent;
        border: none;
        color: #666;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        font-size: 0.7rem;
        border-radius: 4px;
      }
      .agent-tabs button.active {
        background: #333;
        color: #fff;
      }
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 0.75rem;
      }
      .message {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }
      .message.user {
        flex-direction: row-reverse;
      }
      .msg-avatar {
        font-size: 1.2rem;
      }
      .msg-content {
        background: #1a1a1a;
        border-radius: 8px;
        padding: 0.5rem 0.75rem;
        max-width: 80%;
      }
      .message.user .msg-content {
        background: #2a1a3e;
      }
      .msg-content p {
        margin: 0;
        font-size: 0.8rem;
        line-height: 1.4;
      }
      .msg-time {
        font-size: 0.65rem;
        color: #666;
        margin-top: 0.25rem;
        display: block;
      }
      .typing-indicator {
        display: flex;
        gap: 4px;
      }
      .typing-indicator .dot {
        width: 6px;
        height: 6px;
        background: #6c5ce7;
        border-radius: 50%;
        animation: bounce 1.4s infinite ease-in-out;
      }
      .typing-indicator .dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      .typing-indicator .dot:nth-child(3) {
        animation-delay: 0.4s;
      }
      @keyframes bounce {
        0%,
        80%,
        100% {
          transform: scale(0);
        }
        40% {
          transform: scale(1);
        }
      }
      .chat-input {
        padding: 0.75rem;
        border-top: 1px solid #222;
      }
      .suggested-commands {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-bottom: 0.5rem;
      }
      .suggested-commands button {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 999px;
        padding: 0.25rem 0.6rem;
        font-size: 0.7rem;
        color: #888;
        cursor: pointer;
      }
      .input-row {
        display: flex;
        gap: 0.5rem;
      }
      .chat-text-input {
        flex: 1;
        background: #222;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 0.6rem;
        color: #e0e0e0;
        font-size: 0.85rem;
      }
      .btn-send {
        background: #6c5ce7;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 0.6rem 1rem;
        cursor: pointer;
      }
      .btn-send:disabled {
        opacity: 0.5;
      }

      /* Transport */
      .transport-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 1rem;
        background: #1a1a1a;
        border-top: 1px solid #333;
      }
      .transport-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid #555;
        background: transparent;
        color: #fff;
        cursor: pointer;
      }
      .position-slider {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .seek-bar {
        flex: 1;
      }
      .time-display {
        font-size: 0.8rem;
        color: #888;
        min-width: 80px;
      }
      .master-volume {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .master-volume label {
        font-size: 0.75rem;
        color: #888;
      }

      /* Export Modal */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
      }
      .modal-content {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 2rem;
        min-width: 400px;
      }
      .modal-content h3 {
        margin: 0 0 1rem;
      }
      .export-options {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
      }
      .export-options label {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.85rem;
      }
      .export-options select {
        background: #222;
        border: 1px solid #444;
        border-radius: 6px;
        padding: 0.4rem;
        color: #e0e0e0;
      }
      .checkbox-label {
        justify-content: flex-start !important;
        gap: 0.5rem;
      }
      .modal-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
      .btn-primary {
        background: #6c5ce7;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 0.6rem 1.5rem;
        cursor: pointer;
      }
      .btn-secondary {
        background: #333;
        color: #ccc;
        border: 1px solid #555;
        border-radius: 8px;
        padding: 0.6rem 1.5rem;
        cursor: pointer;
      }

      @media (max-width: 1024px) {
        .workspace-body {
          grid-template-columns: 300px 1fr;
        }
        .chat-panel {
          display: none;
        }
      }
      @media (max-width: 768px) {
        .workspace-body {
          grid-template-columns: 1fr;
        }
        .stem-panel {
          display: none;
        }
      }
    `,
  ],
})
export class WorkspaceComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(AudioWorkstationService);
  private readonly destroy$ = new Subject<void>();

  protected readonly Math = Math;

  project = signal<AudioProject | null>(null);
  tracks = signal<Track[]>([]);
  mixSnapshots = signal<MixSnapshot[]>([]);
  chatMessages = signal<ChatMessage[]>([]);

  selectedTrackId: string | null = null;
  selectedTab: 'arrangement' | 'mix' = 'arrangement';
  currentAgent: ActiveAgent = 'compose';
  activeAgents: ActiveAgent[] = ['compose', 'mix', 'master'];

  generationMode: CollaborationMode = 'full-auto';
  generationPrompt = '';
  generationBpm: number | null = null;
  generationKey = '';
  generationGenre = '';
  generationMood = '';
  isGenerating = false;
  showGeneratePanel = false;
  agentIsThinking = false;
  showExportDialog = false;
  chatInput = '';

  exportFormat = 'wav';
  exportQuality = 'high';
  exportIncludeStems = false;

  arrangementSections = [
    { label: 'Intro', bars: 4 },
    { label: 'Verse', bars: 8 },
    { label: 'Chorus', bars: 8 },
  ];

  suggestedCommands = [
    'Make it more energetic',
    'Add a breakdown',
    'Change the drum pattern',
    'Master for Spotify',
  ];

  ngOnInit() {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const projectId = params['projectId'];
      if (projectId) {
        this.loadProject(projectId);
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProject(id: string) {
    this.service.getProject(id).subscribe({
      next: (project) => {
        this.project.set(project);
        this.tracks.set(project.tracks || []);
      },
    });
  }

  selectTrack(track: Track) {
    this.selectedTrackId = track.id;
  }

  toggleMute(track: Track) {
    track.muted = !track.muted;
    this.tracks.update((tracks) =>
      tracks.map((t) => (t.id === track.id ? track : t))
    );
    this.service
      .updateTrack(track.id, { muted: track.muted } as any)
      .subscribe();
  }

  toggleSolo(track: Track) {
    track.solo = !track.solo;
    this.tracks.update((tracks) =>
      tracks.map((t) => (t.id === track.id ? track : t))
    );
    this.service.updateTrack(track.id, { solo: track.solo } as any).subscribe();
  }

  updateVolume(track: Track, event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value);
    track.volume = value;
  }

  updatePan(track: Track, event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value);
    track.pan = value;
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      // In production, upload to assets service
      console.log('File selected:', file.name);
    }
  }

  startGeneration() {
    if (!this.project()) return;

    this.isGenerating = true;
    const projectId = this.project()!.id;

    // Add user message to chat
    this.chatMessages.update((msgs) => [
      ...msgs,
      { role: 'user', text: this.generationPrompt, timestamp: new Date() },
    ]);
    this.agentIsThinking = true;

    const params: any = {};
    if (this.generationBpm) params.bpm = this.generationBpm;
    if (this.generationKey) params.key = this.generationKey;
    if (this.generationGenre) params.genre = this.generationGenre;
    if (this.generationMood) params.mood = this.generationMood;

    this.service
      .requestGeneration(projectId, {
        projectId,
        collaborationMode: this.generationMode,
        prompt: this.generationPrompt,
        parameters: params,
      })
      .subscribe({
        next: (result) => {
          // Poll for completion
          interval(2000)
            .pipe(
              takeUntil(this.destroy$),
              startWith(0),
              switchMap(() =>
                this.service.getGenerationStatus(result.requestId)
              ),
              tap((status) => {
                if (status.status === 'completed') {
                  this.isGenerating = false;
                  this.agentIsThinking = false;
                  this.reloadTracks(projectId);

                  const response = this.getModeCompletionMessage(
                    this.generationMode
                  );
                  this.chatMessages.update((msgs) => [
                    ...msgs,
                    { role: 'agent', text: response, timestamp: new Date() },
                  ]);
                } else if (status.status === 'failed') {
                  this.isGenerating = false;
                  this.agentIsThinking = false;
                  this.chatMessages.update((msgs) => [
                    ...msgs,
                    {
                      role: 'agent',
                      text: `Generation failed: ${
                        status.errorMessage || 'Unknown error'
                      }`,
                      timestamp: new Date(),
                    },
                  ]);
                }
              })
            )
            .subscribe();
        },
        error: (err) => {
          this.isGenerating = false;
          this.agentIsThinking = false;
          this.chatMessages.update((msgs) => [
            ...msgs,
            {
              role: 'agent',
              text: `Error: ${err.message}`,
              timestamp: new Date(),
            },
          ]);
        },
      });
  }

  private reloadTracks(projectId: string) {
    this.service.getTracks(projectId).subscribe({
      next: (tracks) => this.tracks.set(tracks),
    });
  }

  private getModeCompletionMessage(mode: CollaborationMode): string {
    switch (mode) {
      case 'full-auto':
        return "Your track is ready! I've composed, mixed, and mastered everything. Listen to the stems on the left and use the chat if you want any changes.";
      case 'cover':
        return "Your cover arrangement is complete! I've built the instrumental around your vocals. Check the stems and let me know if you want to adjust anything.";
      case 'full-collab':
        return "Here's a first draft of your arrangement. Each stem is fully editable. What would you like to change? I can adjust specific parts, suggest variations, or refine the mix.";
      default:
        return 'Generation complete!';
    }
  }

  sendChatMessage(text: string) {
    if (!text.trim()) return;

    this.chatMessages.update((msgs) => [
      ...msgs,
      { role: 'user', text, timestamp: new Date() },
    ]);
    this.chatInput = '';
    this.agentIsThinking = true;

    // Simulate agent response based on current agent
    setTimeout(() => {
      this.agentIsThinking = false;
      const response = this.getAgentResponse(text, this.currentAgent);
      this.chatMessages.update((msgs) => [
        ...msgs,
        { role: 'agent', text: response, timestamp: new Date() },
      ]);
    }, 1500);
  }

  private getAgentResponse(text: string, agent: ActiveAgent): string {
    const lower = text.toLowerCase();
    if (lower.includes('energetic') || lower.includes('faster')) {
      return "I'll increase the tempo to 135 BPM and add more percussive elements to the arrangement. This should give it the energy boost you're looking for.";
    }
    if (lower.includes('breakdown')) {
      return "Adding a breakdown section after the second chorus. I'll strip back to just the pads and bass for 4 bars, then drop back into a fuller arrangement.";
    }
    if (lower.includes('drum')) {
      return 'I can suggest a few drum pattern variations. Here are three options: 1) Half-time groove, 2) Four-on-the-floor with ghost notes, 3) Syncopated trap pattern. Which would you like to hear?';
    }
    if (lower.includes('master') || lower.includes('spotify')) {
      return "Applying mastering chain for Spotify (-14 LUFS). Current levels: Integrated: -18 LUFS, Dynamic Range: 8dB. I'll apply gentle multiband compression and true-peak limiting.";
    }
    if (agent === 'compose') {
      return "I understand the direction. Let me generate a few variations for the section you mentioned. I'll focus on keeping the arrangement tight and matching the energy profile of similar tracks in this genre.";
    }
    if (agent === 'mix') {
      return "Analyzing the current mix... The drums are sitting well at -3dB. I'd suggest pulling the pads back by 2dB and adding a touch more compression to the bass to tighten the low end. Want me to apply these changes?";
    }
    if (agent === 'master') {
      return "Running analysis on the full mix. I'm seeing good stereo width and balanced frequencies. I'll prepare an A/B comparison with the mastered version so you can hear the difference.";
    }
    return "I've noted your request. Let me work on that and come back with suggestions.";
  }

  switchAgent(agent: ActiveAgent) {
    this.currentAgent = agent;
  }

  playPause() {
    // Playback handled by Web Audio API in production
    console.log('Play/pause');
  }

  stopPlayback() {
    console.log('Stop');
  }

  doExport() {
    if (!this.project()) return;
    this.service
      .startExport(this.project()!.id, {
        format: this.exportFormat,
        quality: this.exportQuality,
        includeStems: this.exportIncludeStems,
      })
      .subscribe({
        next: () => {
          this.showExportDialog = false;
        },
      });
  }

  trackColor(type: string): string {
    const colors: Record<string, string> = {
      vocal: '#e74c3c',
      drum: '#f39c12',
      bass: '#2ecc71',
      guitar: '#3498db',
      synth: '#9b59b6',
      pad: '#1abc9c',
      fx: '#e67e22',
    };
    return colors[type] || '#666';
  }
}
