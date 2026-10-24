// boid.component.ts
import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { NgClass, NgStyle } from '@angular/common';
import { boidColor } from '../classes/BoidColor';

@Component({
  selector: 'app-boid',
  imports: [NgClass, NgStyle],
  templateUrl: './boid.component.html',
  styleUrls: ['./boid.component.sass'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class BoidComponent implements OnChanges {
  @Input() position!: { x: number, y: number };
  @Input() velocity!: { x: number, y: number };
  @Input() isPredator!: boolean;
  @Input() isSuper = false;
  @Input() isDead!: boolean;
  @Input() lineage!: number;          // the mark of its family, in [-1, 1], that gives the color
  @Input() size = 1;                  // a slow boid is bigger, a fast one smaller
  @Input() alpha!: number;
  @Input() darkMode!: boolean;

  colorStyle: { [key: string]: string } = {};

  private static readonly colorInputs = ['isPredator', 'isSuper', 'isDead', 'lineage', 'alpha', 'darkMode'];

  // Angular only reports the inputs that changed: the position and velocity change at each frame, the color rarely
  ngOnChanges(changes: SimpleChanges): void {
    if (BoidComponent.colorInputs.some(input => input in changes)) {
      this.calculateColor();
    }
  }

  private calculateColor(): void {
    this.colorStyle = {
      'color': boidColor(this.isPredator, this.isDead, this.lineage, this.alpha, this.darkMode, 1, this.isSuper)
    };
  }

  calculateRotation(): number {
    // Calculate the angle of the velocity vector
    const angle = Math.atan2(this.velocity.y, this.velocity.x);

    // Convert radians to degrees and add 90 degrees to align with the arrow
    return angle * (180 / Math.PI);
  }
}
