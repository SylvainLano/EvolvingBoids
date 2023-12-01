// boid.component.ts
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-boid',
  templateUrl: './boid.component.html',
  styleUrls: ['./boid.component.sass']
})
export class BoidComponent implements OnChanges {
  @Input() position!: { x: number, y: number };
  @Input() velocity!: { x: number, y: number };
  @Input() isPredator!: boolean;
  @Input() isDead!: boolean;
  @Input() isEvolved!: boolean;
  @Input() alpha!: number;

  colorStyle: { [key: string]: string } = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (this.shouldRecalculateColor(changes)) {
      this.calculateColor();
    }
  }

  private shouldRecalculateColor(changes: SimpleChanges): boolean {
    return (
      changes['alpha'] && changes['alpha'].currentValue !== changes['alpha'].previousValue ||
      changes['isDead'] && changes['isDead'].currentValue !== changes['isDead'].previousValue
    );
  }

  private calculateColor(): void {
    this.colorStyle = {
      'color': this.isDead
        ? `rgba(0, 0, 0, ${this.alpha})`
        : this.isEvolved
          ? this.isPredator
            ? `rgba(${255 * this.alpha}, ${255 - 255 * this.alpha}, 200, 1)`
            : 'rgba(0, 200, 255, 1)'
          : this.isPredator
            ? `rgba(${255 * this.alpha}, ${255 - 255 * this.alpha}, 0, 1)`
            : 'rgba(0, 0, 255, 1)'
    };
  }

  calculateRotation(): number {
    // Calculate the angle of the velocity vector
    const angle = Math.atan2(this.velocity.y, this.velocity.x);

    // Convert radians to degrees and add 90 degrees to align with the arrow
    return angle * (180 / Math.PI);
  }
}
