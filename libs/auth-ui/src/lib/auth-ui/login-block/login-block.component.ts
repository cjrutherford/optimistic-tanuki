import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { Themeable, ThemeColors, ThemeService } from '@optimistic-tanuki/theme-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'lib-login-block',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CardComponent, ButtonComponent, TextInputComponent],
  templateUrl: './login-block.component.html',
  styleUrl: './login-block.component.scss',
  host: {
    // Using standardized local variables with fallbacks
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-border-gradient]': 'borderGradient',
    '[style.--local-transition-duration]': 'transitionDuration',
  }
})
export class LoginBlockComponent extends Themeable{
  @Input()  title = 'login-block works!'; 
  @Input()  description = 'login-block works!';
  @Input() heroSrc = 'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjUyOXwwfDF8c2VhcmNofDJ8fGxvZ298ZW58MHx8fHwxNjg3NTY5NzA1&ixlib=rb-4.0.3&q=80&w=1080';
  @Input() heroAlt = 'login-block works!';
  @Output() submitEvent = new EventEmitter<LoginType>();
  loginForm: FormGroup;
  constructor(private readonly fb: FormBuilder, themeService: ThemeService) {
    super(themeService)
    this.loginForm = this.fb.group({
      email: this.fb.control(''),
      password: this.fb.control(''),
    });
  }


  override applyTheme(colors: ThemeColors): void {
    // Use standardized color assignments with design tokens
    this.background = `linear-gradient(30deg, ${colors.accent}, ${colors.background})`;
    this.accent = colors.accent;
    this.borderColor = colors.complementary;
    
    // Use standardized gradient names
    if(this.theme === 'dark') {
      this.borderGradient = colors.complementaryGradients['dark'];
    } else {
      this.borderGradient = colors.complementaryGradients['light'];
    }
    
    this.foreground = colors.foreground;
    this.complement = colors.complementary;
    this.transitionDuration = '0.15s'; // Use standardized duration
    this.borderColor = colors.complementary;
  }

  onFormChange(e: string) {
    console.log(e);
  }

  onSubmit() {
    console.log(this.loginForm.value);
    this.submitEvent.emit(this.loginForm.value);
  }
}
