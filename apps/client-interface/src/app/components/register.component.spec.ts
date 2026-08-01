import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterComponent } from './register.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent, HttpClientTestingModule],
      providers: [{ provide: API_BASE_URL, useValue: 'http://localhost:3000' }],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reports an error instead of continuing when cookie OAuth session restoration fails', async () => {
    const authStateService = (component as any).authStateService;
    const messageService = (component as any).messageService;
    const handlePostLogin = jest.spyOn(component as any, 'handlePostLogin');
    const addMessage = jest.spyOn(messageService, 'addMessage');

    (component as any).oauthService = {
      initiateOAuthLogin: jest.fn().mockResolvedValue({
        success: true,
        session: true,
      }),
    };
    jest.spyOn(authStateService, 'restoreSession').mockResolvedValue(false);

    await component.onOAuthProvider({ provider: 'google' } as any);

    expect(handlePostLogin).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith({
      content:
        'OAuth registration could not restore your session. Please try again.',
      type: 'error',
    });
  });
});
