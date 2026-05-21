import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ConfirmBlockComponent,
  LoginBlockComponent,
  MfaBlockComponent,
  RegisterBlockComponent,
} from '@optimistic-tanuki/auth-ui';
import {
  ElementCardComponent,
  type ElementConfig,
  IndexChipComponent,
  PageShellComponent,
  type PlaygroundElement,
} from '../../shared';

@Component({
  selector: 'pg-auth-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    LoginBlockComponent,
    RegisterBlockComponent,
    ConfirmBlockComponent,
    MfaBlockComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/auth-ui"
      title="Auth UI"
      description="Authentication workflow primitives for onboarding, sign-in, confirmation, and MFA challenge states."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card [element]="el" [config]="configs[el.id]">
        @switch (el.id) { @case ('login-block') {
        <div class="preview-centered">
          <lib-login-block
            title="Welcome back"
            description="Sign in to continue your workspace session."
          />
        </div>
        } @case ('register-block') {
        <div class="preview-centered">
          <lib-register-block
            registerHeader="Create your account"
            callToAction="Spin up a new profile and workspace."
          />
        </div>
        } @case ('confirm-block') {
        <div class="preview-centered">
          <lib-confirm-block />
        </div>
        } @case ('mfa-block') {
        <div class="preview-centered">
          <lib-mfa-block
            [onboarding]="true"
            qrCodeUrl="otpauth://totp/playground?secret=demo-secret"
          />
        </div>
        } }
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-centered {
        padding: 1.5rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthUiPageComponent {
  readonly importSnippet = `import { LoginBlockComponent, RegisterBlockComponent, ConfirmBlockComponent, MfaBlockComponent } from '@optimistic-tanuki/auth-ui';`;
  configs: Record<string, ElementConfig> = {};
  readonly elements: PlaygroundElement[] = [
    {
      id: 'login-block',
      title: 'Login Block',
      headline: 'Sign-in screen fragment',
      importName: 'LoginBlockComponent',
      selector: 'lib-login-block',
      summary: 'Credential-entry surface for returning users.',
      props: [],
    },
    {
      id: 'register-block',
      title: 'Register Block',
      headline: 'Account creation panel',
      importName: 'RegisterBlockComponent',
      selector: 'lib-register-block',
      summary: 'Account onboarding fragment with a strong call-to-action layout.',
      props: [],
    },
    {
      id: 'confirm-block',
      title: 'Confirm Block',
      headline: 'Email confirmation state',
      importName: 'ConfirmBlockComponent',
      selector: 'lib-confirm-block',
      summary: 'Interim state for verification and resend flows.',
      props: [],
    },
    {
      id: 'mfa-block',
      title: 'MFA Block',
      headline: 'Second-factor verification panel',
      importName: 'MfaBlockComponent',
      selector: 'lib-mfa-block',
      summary: 'Prompt for one-time passcodes during onboarding or step-up auth.',
      props: [],
    },
  ];

  constructor() {
    for (const element of this.elements) {
      this.configs[element.id] = {};
    }
  }
}
