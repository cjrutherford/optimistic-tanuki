import { Component, Input } from '@angular/core';

import { Editor } from '@tiptap/core';

@Component({
  selector: 'lib-context-menu',
  standalone: true,
  imports: [],
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
})
export class ContextMenuComponent {
  @Input() x = 0;
  @Input() y = 0;
  @Input() editor!: Editor;

  async copy(): Promise<void> {
    const { from, to } = this.editor.state.selection;
    const text = this.editor.state.doc.textBetween(from, to);
    if (text) {
      await navigator.clipboard.writeText(text);
    }
  }

  async cut(): Promise<void> {
    await this.copy();
    this.editor.chain().focus().deleteSelection().run();
  }

  async paste(): Promise<void> {
    const text = await navigator.clipboard.readText();
    if (text) {
      this.editor.chain().focus().insertContent(text).run();
    }
  }
}
