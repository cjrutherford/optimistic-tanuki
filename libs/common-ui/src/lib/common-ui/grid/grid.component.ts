import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss',
})
export class GridComponent implements OnInit, OnChanges {
  @Input() columns?: number;
  @Input() rows?: number;

  gridTemplateRows = '';
  gridTemplateColumns = '';
  renderEmpty = false;

  ngOnInit() {
    this.setGridDimensions();
  }

  private setGridDimensions() {
    if (this.columns === 0 || this.rows === 0) {
      this.renderEmpty = true;
      return;
    }

    if (this.columns) {
      this.gridTemplateColumns = `repeat(${this.columns}, 1fr)`;
    }

    if (this.rows) {
      this.gridTemplateRows = `repeat(${this.rows}, 1fr)`;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ngOnChanges(changes: SimpleChanges) {
    this.setGridDimensions();
  }
}
