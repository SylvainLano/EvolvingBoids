// Boid.ts
import type { Quadtree } from './Quadtree';

export interface Point {
  x: number;
  y: number;
}

// Heritable traits: blended from both parents at birth, then possibly altered by a mutation
export interface Genome {
  maxVelocity: number;        // top speed
  reproductionRate: number;   // delay before being able to reproduce again (lower is more fertile)
}

export interface Boid {
  position: Point;
  velocity: Point;
  genome: Genome;
  speedTrait: number;       // deviation of maxVelocity from the species default, normalized in [-1, 1] - drives the color
  fertilityTrait: number;   // deviation of fertility from the species default, normalized in [-1, 1] - drives the color
  isPredator: boolean;
  alpha: number;
  isDead: boolean;
  reproductionCooldown: number;
  predationCounter: number; // predationCounter is time without predation for boids, and time without predating for predators
  quadtree: Quadtree;
  preyLink : Boid | null;   // for Regular Boids, the Predator that chase them, for Predators, the prey !
}
