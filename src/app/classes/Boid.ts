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

// What a reinforcement inherits from an existing or recently dead individual
export interface Heritage {
  genome: Genome;
  generation: number;
}

export interface Boid {
  position: Point;
  velocity: Point;
  genome: Genome;
  speedTrait: number;       // deviation of maxVelocity from the species default, normalized in [-1, 1] - drives the color
  fertilityTrait: number;   // deviation of fertility from the species default, normalized in [-1, 1] - drives the color
  isPredator: boolean;
  isSuper: boolean;         // a Super Predator, added with the mouse: it hunts boids and predators for a while, then fades away
  generation: number;       // 0 for the first boids, then one more than the oldest parent
  isMutant: boolean;        // born with a mutation, on top of the small variation of every birth
  age: number;              // in simulation steps, for regular boids and Super Predators
  lifespanFactor: number;   // random factor applied to the lifespan of regular boids, so they don't all die at the same age
  energy: number;           // regular boids only, from 0 to 1: they eat plankton to gain it, and spend it to swim and reproduce
  geneCost: number;        // lifespan (boids) or starvation resistance (predators) multiplier, lowered by speed and fertility
  alpha: number;
  isDead: boolean;
  reproductionCooldown: number;
  predationCounter: number; // predationCounter is time without predation for boids, and time without predating for predators
  quadtree: Quadtree;
  preyLink : Boid | null;   // for Regular Boids, the Predator that chase them, for Predators, the prey !
  chased: Boid | null;      // predators: the prey of the current chase, to give it up when the chase makes no progress
  closestApproach: number;  // predators: the shortest distance to the chased prey so far
  staleSteps: number;       // predators: simulation steps since the chase last made some progress
  ignoredPrey: Boid | null; // predators: a prey given up, not chased again for a while
  ignoredUntil: number;     // predators: the elapsed step until which the given up prey is ignored
  trail: Point[];           // last positions, oldest first, drawn as a trail by the canvas renderer
}
