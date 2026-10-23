// boid.component.ts
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { boidColor } from '../classes/BoidColor';

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
  @Input() speedTrait!: number;       // in [-1, 1], -1 is the slowest, 1 the fastest
  @Input() fertilityTrait!: number;   // in [-1, 1], -1 is the least fertile, 1 the most fertile
  @Input() alpha!: number;
  @Input() darkMode!: boolean;

  colorStyle: { [key: string]: string } = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (this.shouldRecalculateColor(changes)) {
      this.calculateColor();
    }
  }

  private shouldRecalculateColor(changes: SimpleChanges): boolean {
    return (
      changes['alpha'] && changes['alpha'].currentValue !== changes['alpha'].previousValue ||
      changes['isDead'] && changes['isDead'].currentValue !== changes['isDead'].previousValue ||
      changes['darkMode'] && changes['darkMode'].currentValue !== changes['darkMode'].previousValue ||
      changes['speedTrait'] && changes['speedTrait'].currentValue !== changes['speedTrait'].previousValue ||
      changes['fertilityTrait'] && changes['fertilityTrait'].currentValue !== changes['fertilityTrait'].previousValue
    );
  }

  private calculateColor(): void {
    this.colorStyle = {
      'color': boidColor(this.isPredator, this.isDead, this.speedTrait, this.fertilityTrait, this.alpha, this.darkMode)
    };
  }

  calculateRotation(): number {
    // Calculate the angle of the velocity vector
    const angle = Math.atan2(this.velocity.y, this.velocity.x);

    // Convert radians to degrees and add 90 degrees to align with the arrow
    return angle * (180 / Math.PI);
  }
}
