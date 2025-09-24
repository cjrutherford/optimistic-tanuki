import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';


@Component({
  selector: 'otui-grid',
  standalone: true,
  imports: [],
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss',
})
export class GridComponent implements OnInit, OnChanges {
  @Input() columns?: number;
  @Input() rows?: number;
  @Input() gap = '20px';
  @Input() rowFraction? = '1fr';
  @Input() columnFraction? = '1fr';

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
      this.gridTemplateColumns = `repeat(${this.columns}, ${this.columnFraction})`;
    }

    if (this.rows) {
      this.gridTemplateRows = `repeat(${this.rows}, ${this.rowFraction})`;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ngOnChanges(changes: SimpleChanges) {
    this.setGridDimensions();
  }
}
