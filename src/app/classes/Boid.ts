// Boid.ts
import type { Quadtree } from './Quadtree';

export interface Point {
  x: number;
  y: number;
}

// Heritable traits: each one comes from one of the parents at birth, then a mutation may alter one of them
export interface Genome {
  maxVelocity: number;        // top speed: a fast boid is smaller, and tires sooner
  reproductionRate: number;   // delay before being able to reproduce again (lower is more fertile)
  vision: number;             // factor of the distance at which a boid sees the predators, or a predator the boids: good eyes cost energy or hunger
  focus: number;              // how the field of view is shared between width and length: above 1 narrower and longer, below 1 wider and shorter
  agility: number;            // factor of the turning force: an agile boid turns sharper, but lives shorter (or starves sooner)
  lineage: number;            // the mark of a family, in [-1, 1], that gives the color: it only changes with a mutation
}

export type Gene = 'maxVelocity' | 'reproductionRate' | 'vision' | 'focus' | 'agility';

// What a reinforcement inherits from an existing or recently dead individual
export interface Heritage {
  genome: Genome;
  generation: number;
}

export interface Boid {
  position: Point;
  velocity: Point;
  genome: Genome;
  speedTrait: number;       // deviation of maxVelocity from the species default, normalized in [-1, 1]
  size: number;             // body size, from the speed: the slow boids are bigger and their energy lasts longer
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
  aim: Point | null;        // predators: where a chasing predator heads, null when it sees no prey
  lastSeen: Point | null;   // predators: where the last prey in sight was, a prowling predator goes back there
  trail: Point[];           // last positions, oldest first, drawn as a trail by the canvas renderer
}
