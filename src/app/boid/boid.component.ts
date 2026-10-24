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
  @Input() isSuper = false;
  @Input() isDead!: boolean;
  @Input() speedTrait!: number;       // in [-1, 1], -1 is the slowest, 1 the fastest
  @Input() fertilityTrait!: number;   // in [-1, 1], -1 is the least fertile, 1 the most fertile
  @Input() alpha!: number;
  @Input() darkMode!: boolean;

  colorStyle: { [key: string]: string } = {};

  private static readonly colorInputs = ['isPredator', 'isSuper', 'isDead', 'speedTrait', 'fertilityTrait', 'alpha', 'darkMode'];

  // Angular only reports the inputs that changed: the position and velocity change at each frame, the color rarely
  ngOnChanges(changes: SimpleChanges): void {
    if (BoidComponent.colorInputs.some(input => input in changes)) {
      this.calculateColor();
    }
  }

  private calculateColor(): void {
    this.colorStyle = {
      'color': boidColor(this.isPredator, this.isDead, this.speedTrait, this.fertilityTrait, this.alpha, this.darkMode, 1, this.isSuper)
    };
  }

  calculateRotation(): number {
    // Calculate the angle of the velocity vector
    const angle = Math.atan2(this.velocity.y, this.velocity.x);

    // Convert radians to degrees and add 90 degrees to align with the arrow
    return angle * (180 / Math.PI);
  }
}
