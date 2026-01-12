import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  signal,
  ElementRef,
  ViewChild,
  AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task, Risk, Change } from '@optimistic-tanuki/ui-models';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

export interface MindMapNode {
  id: string;
  type: 'task' | 'risk' | 'change' | 'project';
  title: string;
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface MindMapConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
}

/**
 * Mind map component for visualizing project entities (tasks, risks, changes)
 * Uses a canvas-based drawing approach similar to Excalidraw
 */
@Component({
  selector: 'lib-mind-map',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './mind-map.component.html',
  styleUrls: ['./mind-map.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MindMapComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() tasks: Task[] = [];
  @Input() risks: Risk[] = [];
  @Input() changes: Change[] = [];
  @Input() projectId?: string;
  
  @Output() nodeClick = new EventEmitter<MindMapNode>();
  @Output() nodeMove = new EventEmitter<{ nodeId: string; x: number; y: number }>();
  
  @ViewChild('canvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;
  
  nodes = signal<MindMapNode[]>([]);
  connections = signal<MindMapConnection[]>([]);
  selectedNode = signal<MindMapNode | null>(null);
  
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D | null;
  private isDragging = false;
  private draggedNode: MindMapNode | null = null;
  private offsetX = 0;
  private offsetY = 0;
  private scale = 1;
  private panX = 0;
  private panY = 0;

  ngOnInit(): void {
    this.generateMindMap();
  }

  ngAfterViewInit(): void {
    if (this.canvasRef) {
      this.canvas = this.canvasRef.nativeElement;
      this.ctx = this.canvas.getContext('2d');
      this.setupCanvas();
      this.draw();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tasks'] || changes['risks'] || changes['changes']) {
      this.generateMindMap();
      if (this.ctx) {
        this.draw();
      }
    }
  }

  private setupCanvas(): void {
    if (!this.canvas) return;
    
    // Set canvas size to match container
    const container = this.canvas.parentElement;
    if (container) {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
    }
    
    // Add event listeners
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));
  }

  private generateMindMap(): void {
    const newNodes: MindMapNode[] = [];
    const newConnections: MindMapConnection[] = [];
    
    // Create center project node
    const centerX = 400;
    const centerY = 300;
    
    if (this.projectId) {
      newNodes.push({
        id: 'project-center',
        type: 'project',
        title: 'Project',
        x: centerX,
        y: centerY,
        width: 120,
        height: 60,
        color: '#6366f1',
      });
    }
    
    // Add task nodes in a circle around center
    const taskRadius = 200;
    this.tasks.forEach((task, index) => {
      const angle = (index / this.tasks.length) * 2 * Math.PI;
      const x = centerX + taskRadius * Math.cos(angle);
      const y = centerY + taskRadius * Math.sin(angle);
      
      const node: MindMapNode = {
        id: `task-${task.id}`,
        type: 'task',
        title: task.title,
        description: task.description,
        x,
        y,
        width: 100,
        height: 50,
        color: this.getTaskColor(task.status),
      };
      
      newNodes.push(node);
      
      if (this.projectId) {
        newConnections.push({
          id: `conn-task-${task.id}`,
          from: 'project-center',
          to: node.id,
          label: 'task',
        });
      }
    });
    
    // Add risk nodes
    const riskRadius = 300;
    this.risks.forEach((risk, index) => {
      const angle = (index / this.risks.length) * 2 * Math.PI + Math.PI / 4;
      const x = centerX + riskRadius * Math.cos(angle);
      const y = centerY + riskRadius * Math.sin(angle);
      
      const node: MindMapNode = {
        id: `risk-${risk.id}`,
        type: 'risk',
        title: risk.description.substring(0, 30) + '...',
        description: risk.description,
        x,
        y,
        width: 100,
        height: 50,
        color: this.getRiskColor(risk.impact),
      };
      
      newNodes.push(node);
      
      if (this.projectId) {
        newConnections.push({
          id: `conn-risk-${risk.id}`,
          from: 'project-center',
          to: node.id,
          label: 'risk',
        });
      }
    });
    
    // Add change nodes
    const changeRadius = 250;
    this.changes.forEach((change, index) => {
      const angle = (index / this.changes.length) * 2 * Math.PI + Math.PI / 2;
      const x = centerX + changeRadius * Math.cos(angle);
      const y = centerY + changeRadius * Math.sin(angle);
      
      const node: MindMapNode = {
        id: `change-${change.id}`,
        type: 'change',
        title: change.changeDescription.substring(0, 30) + '...',
        description: change.changeDescription,
        x,
        y,
        width: 100,
        height: 50,
        color: this.getChangeColor(change.changeStatus),
      };
      
      newNodes.push(node);
      
      if (this.projectId) {
        newConnections.push({
          id: `conn-change-${change.id}`,
          from: 'project-center',
          to: node.id,
          label: 'change',
        });
      }
    });
    
    this.nodes.set(newNodes);
    this.connections.set(newConnections);
  }

  private draw(): void {
    if (!this.ctx || !this.canvas) return;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Save context state
    this.ctx.save();
    
    // Apply transformations
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.scale, this.scale);
    
    // Draw connections
    this.connections().forEach(conn => {
      this.drawConnection(conn);
    });
    
    // Draw nodes
    this.nodes().forEach(node => {
      this.drawNode(node);
    });
    
    // Restore context state
    this.ctx.restore();
  }

  private drawNode(node: MindMapNode): void {
    if (!this.ctx) return;
    
    const isSelected = this.selectedNode()?.id === node.id;
    
    // Draw shadow for selected node
    if (isSelected) {
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      this.ctx.shadowBlur = 10;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 4;
    }
    
    // Draw node rectangle
    this.ctx.fillStyle = node.color || '#ffffff';
    this.ctx.strokeStyle = isSelected ? '#000000' : '#666666';
    this.ctx.lineWidth = isSelected ? 3 : 1;
    
    this.roundRect(
      this.ctx,
      node.x - node.width / 2,
      node.y - node.height / 2,
      node.width,
      node.height,
      8
    );
    
    this.ctx.fill();
    this.ctx.stroke();
    
    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    
    // Draw text
    this.ctx.fillStyle = '#000000';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const lines = this.wrapText(node.title, node.width - 10);
    lines.forEach((line, i) => {
      const lineY = node.y + (i - (lines.length - 1) / 2) * 14;
      this.ctx!.fillText(line, node.x, lineY);
    });
  }

  private drawConnection(conn: MindMapConnection): void {
    if (!this.ctx) return;
    
    const fromNode = this.nodes().find(n => n.id === conn.from);
    const toNode = this.nodes().find(n => n.id === conn.to);
    
    if (!fromNode || !toNode) return;
    
    this.ctx.strokeStyle = '#cccccc';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(fromNode.x, fromNode.y);
    this.ctx.lineTo(toNode.x, toNode.y);
    this.ctx.stroke();
    
    this.ctx.setLineDash([]);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length * 7 > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  private onMouseDown(event: MouseEvent): void {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.panX) / this.scale;
    const y = (event.clientY - rect.top - this.panY) / this.scale;
    
    // Check if clicked on a node
    const clickedNode = this.nodes().find(node => 
      x >= node.x - node.width / 2 &&
      x <= node.x + node.width / 2 &&
      y >= node.y - node.height / 2 &&
      y <= node.y + node.height / 2
    );
    
    if (clickedNode) {
      this.isDragging = true;
      this.draggedNode = clickedNode;
      this.offsetX = x - clickedNode.x;
      this.offsetY = y - clickedNode.y;
      this.selectedNode.set(clickedNode);
      this.nodeClick.emit(clickedNode);
      this.draw();
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.canvas || !this.isDragging || !this.draggedNode) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.panX) / this.scale;
    const y = (event.clientY - rect.top - this.panY) / this.scale;
    
    this.draggedNode.x = x - this.offsetX;
    this.draggedNode.y = y - this.offsetY;
    
    this.draw();
  }

  private onMouseUp(event: MouseEvent): void {
    if (this.draggedNode) {
      this.nodeMove.emit({
        nodeId: this.draggedNode.id,
        x: this.draggedNode.x,
        y: this.draggedNode.y,
      });
    }
    
    this.isDragging = false;
    this.draggedNode = null;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    this.scale *= delta;
    this.scale = Math.max(0.1, Math.min(3, this.scale));
    
    this.draw();
  }

  private getTaskColor(status: Task['status']): string {
    switch (status) {
      case 'TODO': return '#93c5fd';
      case 'IN_PROGRESS': return '#fbbf24';
      case 'DONE': return '#86efac';
      case 'ARCHIVED': return '#d1d5db';
      default: return '#ffffff';
    }
  }

  private getRiskColor(impact: Risk['impact']): string {
    switch (impact) {
      case 'HIGH': return '#fca5a5';
      case 'MEDIUM': return '#fed7aa';
      case 'LOW': return '#bfdbfe';
      default: return '#ffffff';
    }
  }

  private getChangeColor(status: Change['changeStatus']): string {
    switch (status) {
      case 'COMPLETE': return '#86efac';
      case 'IMPELEMENTING': return '#fbbf24'; // Note: typo in original Change model
      case 'PENDING_APPROVAL': return '#c4b5fd';
      case 'DISCARDED': return '#d1d5db';
      default: return '#e9d5ff';
    }
  }

  resetView(): void {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.draw();
  }

  exportAsImage(): void {
    if (!this.canvas) return;
    
    const dataUrl = this.canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'mind-map.png';
    link.href = dataUrl;
    link.click();
  }
}
