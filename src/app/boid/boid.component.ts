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

  // The color is derived from the genes:
  // - speed shifts the hue (boids: violet <- blue -> cyan, predators: orange <- red -> magenta)
  // - fertility shifts the lightness (more fertile is brighter)
  // - a digesting predator loses its saturation
  private calculateColor(): void {
    if (this.isDead) {
      this.colorStyle = {
        'color': this.darkMode ? `rgba(255, 255, 255, ${this.alpha})` : `rgba(0, 0, 0, ${this.alpha})`
      };
      return;
    }

    const hue = this.isPredator
      ? (360 - 40 * this.speedTrait) % 360
      : 240 - 50 * this.speedTrait;
    const saturation = this.isPredator ? 100 * this.alpha : 100;
    const lightness = (this.darkMode ? (this.isPredator ? 72 : 70) : 45) + 12 * this.fertilityTrait;

    this.colorStyle = {
      'color': `hsl(${hue}, ${saturation}%, ${lightness}%)`
    };
  }

  calculateRotation(): number {
    // Calculate the angle of the velocity vector
    const angle = Math.atan2(this.velocity.y, this.velocity.x);

    // Convert radians to degrees and add 90 degrees to align with the arrow
    return angle * (180 / Math.PI);
  }
}
