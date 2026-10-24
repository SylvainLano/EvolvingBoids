// Statistics.ts
import type { Boid } from './Boid';

// Genes are expressed as a deviation in percent from the species default, so both species share the same scale
export interface StatsSample {
  boids: number;
  predators: number;
  boidSpeed: number;            // NaN when there is no boid
  predatorSpeed: number;
  boidFertility: number;
  predatorFertility: number;
  boidVision: number;
  predatorVision: number;       // NaN when the predators see the whole screen
  boidFocus: number;            // NaN when the boids see all around
  predatorFocus: number;        // NaN when the predators see the whole screen, or all around
  food: number;                 // plankton compared to what the fertile areas can hold, in percent, NaN without plankton
  plants: number;               // number of algae, NaN without them
  winter: boolean;              // drawn as a band behind the charts
}

export interface SpeciesDefaults {
  maxVelocity: number;
  reproductionRate: number;
}

// The genes that matter with the current settings, the others are not charted
export interface ExpressedGenes {
  predatorVision: boolean;
  boidFocus: boolean;
  predatorFocus: boolean;
}

export class Statistics {
  samples: StatsSample[] = [];
  maxBoidGeneration = 0;
  maxPredatorGeneration = 0;

  readonly sampleInterval = 60;     // simulation steps between two samples (1 second of simulated time)
  readonly maxSamples = 900;        // 15 minutes of simulated time
  private stepsSinceSample = 0;

  clear() {
    this.samples = [];
    this.maxBoidGeneration = this.maxPredatorGeneration = 0;
    this.stepsSinceSample = 0;
  }

  // Called at each simulation step, records a sample at regular intervals
  // The food ratio is only computed when a sample is recorded
  step(boids: Boid[], predators: Boid[], boidDefaults: SpeciesDefaults, predatorDefaults: SpeciesDefaults, foodRatio: () => number,
    winter: boolean, plants: number, expressed: ExpressedGenes) {
    if (++this.stepsSinceSample < this.sampleInterval && this.samples.length > 0) {
      return;
    }
    this.stepsSinceSample = 0;

    // Super Predators are a tool of the user, not part of the evolution
    const livingPredators = predators.filter(predator => !predator.isDead && !predator.isSuper);
    const boidGenes = this.averageGenes(boids, boidDefaults);
    const predatorAverages = this.averageGenes(livingPredators, predatorDefaults);

    this.samples.push({
      boids: boids.length,
      predators: livingPredators.length,
      boidSpeed: boidGenes.speed,
      predatorSpeed: predatorAverages.speed,
      boidFertility: boidGenes.fertility,
      predatorFertility: predatorAverages.fertility,
      boidVision: boidGenes.vision,
      predatorVision: expressed.predatorVision ? predatorAverages.vision : NaN,
      boidFocus: expressed.boidFocus ? boidGenes.focus : NaN,
      predatorFocus: expressed.predatorFocus ? predatorAverages.focus : NaN,
      food: foodRatio() * 100,
      plants,
      winter,
    });
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    for (const boid of boids) {
      this.maxBoidGeneration = Math.max(this.maxBoidGeneration, boid.generation);
    }
    for (const predator of livingPredators) {
      this.maxPredatorGeneration = Math.max(this.maxPredatorGeneration, predator.generation);
    }
  }

  // A lower reproduction rate means a higher fertility, the vision and the focus are factors of 1 by default
  private averageGenes(population: Boid[], defaults: SpeciesDefaults): { speed: number, fertility: number, vision: number, focus: number } {
    if (population.length === 0) {
      return { speed: NaN, fertility: NaN, vision: NaN, focus: NaN };
    }
    let maxVelocity = 0;
    let reproductionRate = 0;
    let vision = 0;
    let focus = 0;
    for (const boid of population) {
      maxVelocity += boid.genome.maxVelocity;
      reproductionRate += boid.genome.reproductionRate;
      vision += boid.genome.vision;
      focus += boid.genome.focus;
    }
    return {
      speed: (maxVelocity / population.length / defaults.maxVelocity - 1) * 100,
      fertility: -(reproductionRate / population.length / defaults.reproductionRate - 1) * 100,
      vision: (vision / population.length - 1) * 100,
      focus: (focus / population.length - 1) * 100,
    };
  }
}
