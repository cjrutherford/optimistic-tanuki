import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MessageComponent } from './message.component';
import { MessageService } from '../message.service';

describe('MessageUiComponent', () => {
  let component: MessageComponent;
  let fixture: ComponentFixture<MessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the toast layer nonblocking while preserving an accessible dismiss control', () => {
    const styles = readFileSync(
      join(__dirname, 'message.component.scss'),
      'utf8'
    );
    const messageService = TestBed.inject(MessageService);
    messageService.addMessage({ type: 'success', content: 'Project saved' });
    fixture.detectChanges();

    expect(styles).toMatch(
      /\.message-container\s*\{[\s\S]*pointer-events:\s*none/
    );
    expect(styles).toMatch(/\.message\s*\{[\s\S]*pointer-events:\s*auto/);
    expect(
      fixture.nativeElement.querySelector('otui-button .message-dismiss-label')
        ?.textContent
    ).toContain('Dismiss message');
    expect(
      fixture.nativeElement.querySelector('otui-button button:not([disabled])')
    ).toBeTruthy();
  });
});
