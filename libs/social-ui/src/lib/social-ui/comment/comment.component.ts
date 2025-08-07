import { CommonModule } from "@angular/common";
import { Component, OnInit, Output, EventEmitter, ViewChild, TemplateRef } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CardComponent, ButtonComponent } from "@optimistic-tanuki/common-ui";
import { Themeable, ThemeColors, ThemeService } from "@optimistic-tanuki/theme-ui";
import { QuillModule, QuillModules } from "ngx-quill";
import { MatDialog } from "@angular/material/dialog";

/**
 * Component for creating and managing comments with rich text editing capabilities.
 */
@Component({
  selector: 'lib-comment',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, ButtonComponent, QuillModule],
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
  }
})
export class CommentComponent extends Themeable implements OnInit {
  /**
   * Emits the content of the added comment.
   */
  @Output() commentAdded: EventEmitter<string> = new EventEmitter<string>();
  /**
   * Template reference for the comment dialog.
   */
  @ViewChild('commentDialog') commentDialog!: TemplateRef<HTMLElement>;
  /**
   * The content of the comment being edited.
   */
  comment = '';
  /**
   * The accent shade color from the theme.
   */
  accentShade!: string;

  /**
   * Creates an instance of CommentComponent.
   * @param dialog The MatDialog service.
   * @param themeService The ThemeService instance.
   */
  constructor(private dialog: MatDialog, themeService: ThemeService) {
    super(themeService)
  }

  /**
   * Applies the given theme colors to the component's styles.
   * @param colors The theme colors to apply.
   */
  override applyTheme(colors: ThemeColors) {
    this.background = `linear-gradient(30deg, ${colors.accent}, ${colors.background})`;
    this.accent = colors.accent;
    this.borderColor = colors.complementary;
    if (this.theme === 'dark') {
      this.borderGradient = colors.complementaryGradients['dark'];
      this.accentShade = colors.accentShades[6][1]
    } else {
      this.borderGradient = colors.complementaryGradients['light'];
      this.accentShade = colors.accentShades[2][1]
    }
    this.foreground = colors.foreground;
    this.complement = colors.complementary;
    this.transitionDuration = '0.5s';
  }

  /**
   * Quill editor modules configuration.
   */
  modules: QuillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
      ['blockquote', 'code-block'],

      [{ 'header': 1 }, { 'header': 2 }],               // custom button values
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
      [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
      [{ 'direction': 'rtl' }],                         // text direction

      [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],

      [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
      [{ 'font': [] }],
      [{ 'align': [] }],

      ['clean'],                                         // remove formatting button

      ['link', 'image', 'video']                         // link and image, video
    ]
  };

  /**
   * Opens the comment dialog.
   */
  openCommentDialog() {
    this.dialog.closeAll();
    this.dialog.open(this.commentDialog);
  }

  /**
   * Handles the submission of the comment.
   */
  onSubmit() {
    this.commentAdded.emit(this.comment);
    this.comment = ''
    this.dialog.closeAll();
  }

  /**
   * Handles the cancellation of the comment.
   */
  onCancel() {
    this.comment = '';
    this.dialog.closeAll();
  }
}
