import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { QuillModule, QuillModules } from 'ngx-quill';
import {
  Themeable,
  ThemeColors,
  ThemeService,
} from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'lib-comment',
  standalone: true,
  imports: [FormsModule, CardComponent, ButtonComponent, QuillModule],
  providers: [],
  templateUrl: './comment.component.html',
  styleUrl: './comment.component.scss',
  host: {
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
    '[style.--accent-shade]': 'accentShade',
  },
})
export class CommentComponent extends Themeable implements OnInit {
  @Output() commentAdded: EventEmitter<string> = new EventEmitter<string>();
  @ViewChild('commentDialog') commentDialog!: TemplateRef<HTMLElement>;
  comment = '';
  accentShade!: string;

  constructor(private dialog: MatDialog) {
    super();
  }

  override applyTheme(colors: ThemeColors) {
    this.background = `linear-gradient(30deg, ${colors.accent}, ${colors.background})`;
    this.accent = colors.accent;
    this.borderColor = colors.complementary;
    if (this.theme === 'dark') {
      this.borderGradient = colors.complementaryGradients['dark'];
      this.accentShade = colors.accentShades[6][1];
    } else {
      this.borderGradient = colors.complementaryGradients['light'];
      this.accentShade = colors.accentShades[2][1];
    }
    this.foreground = colors.foreground;
    this.complement = colors.complementary;
    this.transitionDuration = '0.5s';
  }

  modules: QuillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'], // toggled buttons
      ['blockquote', 'code-block'],

      [{ header: 1 }, { header: 2 }], // custom button values
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ script: 'sub' }, { script: 'super' }], // superscript/subscript
      [{ indent: '-1' }, { indent: '+1' }], // outdent/indent
      [{ direction: 'rtl' }], // text direction

      [{ size: ['small', false, 'large', 'huge'] }], // custom dropdown
      [{ header: [1, 2, 3, 4, 5, 6, false] }],

      [{ color: [] }, { background: [] }], // dropdown with defaults from theme
      [{ font: [] }],
      [{ align: [] }],

      ['clean'], // remove formatting button

      ['link', 'image', 'video'], // link and image, video
    ],
  };

  openCommentDialog() {
    this.dialog.closeAll();
    this.dialog.open(this.commentDialog);
  }

  onSubmit() {
    this.commentAdded.emit(this.comment);
    this.comment = '';
    this.dialog.closeAll();
  }

  onCancel() {
    this.comment = '';
    this.dialog.closeAll();
  }
}
