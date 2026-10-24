// Simulation.ts
import { Quadtree } from './Quadtree';
import { Boid, Genome, Heritage, Point } from './Boid';
import { SegmentField } from './SegmentField';
import { FoodField } from './FoodField';
import { PlantField } from './Plants';
import { Statistics } from './Statistics';

export type SimulationMode = 'DeathMatch' | 'Retry' | 'Continued' | 'Infinite';
export type LowFPSAction = 'PopulationControl' | 'BudgetCuts' | 'Nothing';
export type SeasonName = 'Spring' | 'Summer' | 'Autumn' | 'Winter';
const SEASONS: SeasonName[] = ['Spring', 'Summer', 'Autumn', 'Winter'];

// What happens in the simulation, for the display: a death has its cause, a capture its hunter (boid) and prey (other)
export type DeathCause = 'oldAge' | 'starved' | 'predatorStarved' | 'superPredatorGone' | 'erased';
export type SimulationEventType = DeathCause | 'birth' | 'mutant' | 'caught' | 'gaveUp' | 'reinforcement' | 'superPredator';
export interface SimulationEvent {
  type: SimulationEventType;
  boid: Boid;
  other?: Boid;     // the parent of a newborn, the prey of a hunter
}

// The simulation engine: the boids, the predators and their world, without anything about the display
export class Simulation {
  // Regular Boids
  boids: Boid[] = [];
  numberOfBoids = 150;                // number of boids created when the simulation starts
  boidReproductionRate = 300;         // delay before a boid can reproduce again - can be modified by evolution and by the input boidReproductionModificator
  reproductionThreshold = 600;        // needed quiet time to nest - can be modified by the input boidReproductionModificator
  boidLifespan = 180;                 // average lifespan in seconds (+/- 20 %), 0 for immortal boids - can be modified by the user
  partnerAngleThreshold = 0.3;        // maximum angle in radians between the directions of two partners
  reproductionRadius = 20;            // radius to find a partner (needed to reproduce for regular Boids only)
  boidReproductionChances = 40;       // percentage of chances to reproduce - can be modified by the user
  boidEvolutionChances = 5;           // chances for the child to evolve - can be modified by the user
  boidEvolutionStep = 5;              // size of steps of evolution modification in percent
  boidEvolutionCap = 50;              // maximum evolution modification in percent - can be modified by the user
  boidMaxVelocity = 2;                // maximum starting velocity of the boids - can be modified by evolution
  alignmentRadius = 30;               // radius to align with other boids - can be modified by the user
  cohesionRadius = 40;                // radius to join other boids - can be modified by the user
  boidsSeparationRadius = 20;         // radius to move from other boids - can be modified by the user
  boidMaxSteeringForce = 0.1;         // maximum force to change direction
  fleeRadius = 60;                    // distance at which a boid detects a predator - can be modified by the user
  fleeFactor = 5;                     // importance of the flee regarding other directionnal factors - can be modified by the user
  fleeForceThreshold = 0.2;           // maximum fleeing force to have a quiet time - can be modified by the input boidReproductionModificator
  fleeReset = false;                  // does the fleeing process restarts the quiet time to 0
  boidReproductionModificator = 0;    // increase or decrease the reproduction rate for Boids

  // Evolution, for both species
  birthVariation = 2;                 // random variation of every gene at each birth, in percent
  geneCostFactor = 1.5;               // each +10 % of speed or fertility costs 15 % of lifespan (boids) or starvation resistance (predators) - can be modified by the user
  minGeneCost = 0.2;                  // the gene cost never shortens a life below 20 %
  traitScale = 0.5;                   // gene deviation from the species default that gives the most extreme trait
  genePoolSize = 30;                  // number of dead individuals whose genes are remembered, per species
  lineageStep = 0.25;                 // shift of the family color at each mutation, within [-1, 1]
  founderLineage = 0.1;               // the first individuals have nearly the same color: the families appear with the mutations
  sizeEffect = 1.5;                   // a boid 10 % faster than the default is 15 % smaller, a slower one bigger
  sizeEndurance = 0.5;                // the energy of a boid lasts as long as the square root of its size
  boidEyesCost = 0.00005;             // energy per step and per unit of gene cost, times (vision² - 1): good eyes cost energy

  // Plankton
  foodEnabled = true;                 // boids eat plankton: they need energy to reproduce, and starve without it - can be modified by the user
  fertileAreas = 1;                   // number of drifting areas where the plankton grows - can be modified by the user
  summerAreas = 1;                    // fertile areas added in summer, with the seasons
  plantsEnabled = true;               // algae grow in place, the boids nibble them - can be modified by the user
  plants = new PlantField();
  plantSight = 150;                   // distance at which a hungry boid sees an alga
  foodUpdateInterval = 6;             // simulation steps between two growths of the plankton
  boidBaseMetabolism = 0.0001;        // energy spent per step, even at rest
  boidSwimCost = 0.0002;              // energy spent per step swimming at the default boid speed, it grows with the square of the speed
  eatQuantity = 0.005;                // maximum food eaten per step: boids graze for a while to fill up
  reproductionEnergy = 0.8;           // energy needed to nest: after a birth, a boid has to eat before nesting again
  birthEnergyCost = 0.3;              // energy spent by each parent at a birth, the child starts with both
  foodAttraction = 1.5;               // importance of looking for food when hungry, regarding other directional factors
  grazingAttraction = 0.4;            // part of the food attraction kept when not hungry: the flocks stay on their pastures and follow them

  // Seasons
  seasonsEnabled = true;              // the plankton thrives in summer and fades in winter - can be modified by the user
  yearDuration = 8;                   // in simulated minutes, a year starts with the spring - can be modified by the user
  winterFood = 20;                    // plankton the fertile areas hold in the middle of winter, in percent of the summer - can be modified by the user
  readonly yearStart = 0.2;           // part of the year already gone when the simulation starts

  // Population limits
  infiniteMinBoids = 30;              // in Infinite mode, reinforcements arrive when there are fewer boids than this, enough for them to find partners
  areaPerBoid = 4000;                 // screen area in px² per boid when the screen is full, boids stop reproducing at this density

  // Predators
  predators: Boid[] = [];
  numberOfPredators = 3;              // number of predators created when the simulation starts
  predatorReproductionRate = 300;     // delay before a predator can reproduce again - can be modified by evolution and by the input predatorReproductionModificator
  predatorReproductionChances = 20;   // percentage of chances to reproduce after a meal - can be modified by the user
  preyPerPredator = 25;               // a predator only breeds when there are this many boids per predator: they can't swarm
  predatorEvolutionChances = 5;       // chances for the child to evolve - can be modified by the user
  predatorEvolutionStep = 5;          // size of steps of evolution modification in percent
  predatorEvolutionCap = 50;          // maximum evolution modification in percent - can be modified by the user
  predatorMaxSteeringForce = 0.12;    // maximum force to change direction
  predatorsSeparationRadius = 50;     // radius to move from other boids - can be modified by the user
  predatorMaxVelocity = 2.5;          // maximum velocity of the chasing predator - can be modified by evolution
  starvationThreshold = 2000;         // delay before a predator starves to death - can be modified by the input predatorStarvationModificator
  captureDistance = 5;                // distance to get to eat a boid
  predatorsCooperativeness = true;    // Do Predator cooperative to chase different preys
  predatorVersatility = true;         // Can predators change prey after choosing one
  chasePatience = 3;                  // in seconds: a predator that doesn't get closer to its prey for this long gives it up
  chaseProgress = 5;                  // in px: what getting closer means
  ignoreDuration = 10;                // in seconds: a prey given up is not chased again for this long
  predatorReproductionModificator = 0;    // increase or decrease the reproduction rate for Predators
  predatorStarvationModificator = 0;      // increase or decrease the starvation resistance for Predators

  // Super Predators
  superPredatorMaxVelocity = 3.2;
  superPredatorLifetime = 45;         // in seconds
  superPredatorCaptureDistance = 8;
  superPredatorMaxSteeringForce = 0.15;
  superFleeRadius = 120;              // distance at which predators flee a Super Predator

  // Obstacles, currents and borders
  obstacleAvoidRadius = 35;           // distance at which boids start to steer away from an obstacle, beyond the distance they need to turn
  obstacleAvoidanceForce = 3;         // importance of avoiding obstacles regarding other directional factors
  obstacles = new SegmentField(this.obstacleAvoidRadius + 5);   // the reach includes the move of a step, to detect the crossings
  currentRadius = 30;                 // half width of a current
  currentStrength = 1.5;              // speed in px per step given by a current at its center
  currentAlignment = 0.05;            // how fast a current turns the boids in its direction
  currents = new SegmentField(this.currentRadius);
  borderDistance = 50;                // distance at which a boid start to avoid a border
  borderAvoidanceForce = 5;           // factor to avoid screen borders

  // Simulation
  readonly stepDuration = 1000 / 60;  // duration of a simulation step in ms - the simulation runs at 60 steps per second
  readonly stepsPerSecond = 1000 / this.stepDuration;
  pauseSimulation = false;
  simulationMode: SimulationMode = 'Infinite';
  lowFPSAction: LowFPSAction = 'PopulationControl';
  trailLength = 8;                    // number of past positions remembered by each boid, to draw its trail
  rangeQueryCap = 6;                  // number of neighboring boids each individual relies onto
  width = 0;
  height = 0;
  quadtree = new Quadtree(0, 0, 0, 0, 24);
  food = new FoodField(0, 0, this.fertileAreas);
  stats = new Statistics();
  totalBoids = 0;
  totalPredators = 0;
  elapsedSteps = 0;                   // simulation steps since the start, the pauses excluded

  // Inputs from the display
  mousePosition: Point | null = null; // the mouse scares the boids like a predator, null when it doesn't
  fps = 60;                           // boids are not created under the minimum FPS
  minFPS = 20;
  errorMessage = '';
  errorFadeOut = 0;
  onEvent: (event: SimulationEvent) => void = () => {};

  private boidGenePool: Heritage[] = [];
  private predatorGenePool: Heritage[] = [];
  private stepsSinceFoodUpdate = 0;
  private lastBoidBirthPosition: Point = { x: 0, y: 0 };

  // A new population in a new world, the obstacles and currents drawn by the user are kept
  initialize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.quadtree = new Quadtree( 0, 0, width, height, 24 );
    this.food = new FoodField( width, height, this.fertileAreas );
    this.plants.initialize(width, height);
    this.stepsSinceFoodUpdate = 0;
    this.stats.clear();
    this.boidGenePool = [];
    this.predatorGenePool = [];
    this.boids = [];
    this.predators = [];
    this.totalBoids = this.totalPredators = 0;
    this.elapsedSteps = 0;

    // Initialize boids with random positions and velocities
    for (let i = 0; i < this.numberOfBoids; i++) {
      this.createBoid (
        { x: Math.random() * width, y: Math.random() * height },
        { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        false,
        this.createGenome(false),
        Math.random() * this.boidReproductionRate
      );
    }

    // The first boids have random ages and energies, so they don't all die or nest at the same time
    for (const boid of this.boids) {
      boid.age = Math.random() * this.boidLifespan * this.stepsPerSecond * 0.8;
      boid.energy = 0.5 + Math.random() * 0.4;
    }

    // Initialize predators with random positions, velocities, and reproduction rate
    for (let i = 0; i < this.numberOfPredators; i++) {
      this.createBoid (
        { x: Math.random() * width, y: Math.random() * height },
        { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        true,
        this.createGenome(true),
        Math.random() * this.predatorReproductionRate
      );
    }
  }

  // Fit the simulation to a new window size (resize, fullscreen) without restarting it
  resize(width: number, height: number) {
    if ( width === 0 || height === 0 || ( width === this.width && height === this.height ) ) {
      return;
    }
    // Started without a size (in a hidden page), there is nothing to keep
    if ( this.width === 0 || this.height === 0 ) {
      this.initialize(width, height);
      return;
    }
    // Positions are scaled to the new size, so the boids keep their layout and none is left outside
    const scaleX = width / this.width;
    const scaleY = height / this.height;
    const scale = (point: Point): Point => ({
      x: Math.min(width - 1, Math.max(0, point.x * scaleX)),
      y: Math.min(height - 1, Math.max(0, point.y * scaleY)),
    });
    this.width = width;
    this.height = height;
    this.quadtree = new Quadtree( 0, 0, width, height, 24 );

    for (const boid of [...this.boids, ...this.predators]) {
      boid.position = scale(boid.position);
      boid.trail = boid.trail.map(scale);
      this.quadtree.insert(boid);
    }
    this.obstacles.transform(scale);
    this.currents.transform(scale);
    this.food.resize(width, height);
    this.plants.resize(width, height);
  }

  // Where the year is: the integer part counts the years, the decimals go from the spring to the winter
  // The simulation starts at the end of spring, when the plankton is nearly at its best
  private get years(): number {
    return this.yearStart + this.elapsedSteps / this.stepsPerSecond / 60 / this.yearDuration;
  }

  // The growth of the plankton, from 1 in the middle of summer down to the winter food in the middle of winter
  get productivity(): number {
    if ( !this.seasonsEnabled ) {
      return 1;
    }
    const winter = this.winterFood / 100;
    const progress = this.years - Math.floor(this.years);
    return (1 + winter) / 2 + (1 - winter) / 2 * Math.cos(2 * Math.PI * (progress - 0.375));
  }

  get season(): { name: SeasonName, year: number, progress: number } {
    const progress = this.years - Math.floor(this.years);
    return { name: SEASONS[Math.min(3, Math.floor(progress * 4))], year: Math.floor(this.years) + 1, progress };
  }

  step() {
    if ( this.pauseSimulation ) {
      return;
    }
    this.elapsedSteps++;

    this.totalBoids = this.boids.length;
    // Super Predators are a tool of the user, they don't count as predators
    this.totalPredators = this.predators.filter(predator => !predator.isSuper).length;

    // The plankton grows every few steps, it is enough for its slow pace, and less in winter
    if ( this.foodEnabled && ++this.stepsSinceFoodUpdate >= this.foodUpdateInterval ) {
      this.food.setPatchCount(this.fertileAreas + (this.seasonsEnabled && this.season.name === 'Summer' ? this.summerAreas : 0));
      this.food.productivity = this.productivity;
      this.food.update(this.stepsSinceFoodUpdate);
      if ( this.plantsEnabled ) {
        this.plants.update(this.stepsSinceFoodUpdate, this.productivity);
      }
      this.stepsSinceFoodUpdate = 0;
    }

    this.dealWithDepletion();

    this.stats.step(
      this.boids,
      this.predators,
      { maxVelocity: this.boidMaxVelocity, reproductionRate: this.boidReproductionRate },
      { maxVelocity: this.predatorMaxVelocity, reproductionRate: this.predatorReproductionRate },
      () => this.foodEnabled ? this.food.fillRatio() : NaN,
      this.seasonsEnabled && this.season.name === 'Winter',
      this.foodEnabled && this.plantsEnabled ? this.plants.plants.length : NaN
    );

    // Boids behavior rules
    for (const boid of [...this.boids, ...this.predators]) {
      // Eaten earlier during this step: it is not in the simulation anymore
      if ( this.isGone(boid) ) {
        continue;
      }

      // Avoid borders: Redirect away from the borders
      const avoidBorders = this.avoidBorders(boid);

      // Regular boids die of old age, a lifespan of 0 makes them immortal
      if ( !boid.isPredator && !boid.isDead ) {
        boid.age++;
        if ( this.boidLifespan > 0 && boid.age >= this.boidLifespan * this.stepsPerSecond * boid.lifespanFactor * boid.geneCost ) {
          this.kill(boid, 'oldAge');
        }
      }

      if ( boid.isDead ) {
        this.fadeAway(boid);
        // Faded away and out of the Quadtree: a move would put it back in
        if ( this.isGone(boid) ) {
          continue;
        }
      } else if ( !boid.isPredator ) {
        this.moveBoid(boid, avoidBorders);
      } else if ( boid.isSuper ) {
        this.moveSuperPredator(boid, avoidBorders);
      } else {
        this.movePredator(boid, avoidBorders);
      }

      // Update position based on velocity, carried by the currents, without crossing the obstacles
      const flow = this.currentFlow(boid);
      let newPosition: Point = { x: boid.position.x + boid.velocity.x + flow.x, y: boid.position.y + boid.velocity.y + flow.y };
      if ( !this.obstacles.isEmpty ) {
        newPosition = this.collideWithObstacles(boid, newPosition);
      }
      // Kept inside the screen: out of its bounds, a boid would fall out of the Quadtree
      newPosition.x = Math.min(this.width - 0.01, Math.max(0, newPosition.x));
      newPosition.y = Math.min(this.height - 0.01, Math.max(0, newPosition.y));

      // Update the boid's position
      boid.quadtree.move( boid, newPosition );

      // Remember the position for the trail - move() gives the boid a new position object, so it can be kept as is
      if ( this.trailLength > 0 ) {
        boid.trail.push(boid.position);
        if ( boid.trail.length > this.trailLength ) {
          boid.trail.splice(0, boid.trail.length - this.trailLength);
        }
      } else if ( boid.trail.length > 0 ) {
        boid.trail = [];
      }
    }
  }

  // A dead boid starts fading away, its genes are remembered for the reinforcements
  kill(boid: Boid, cause?: DeathCause) {
    boid.isDead = true;
    if ( !boid.isSuper ) {
      this.rememberGenes(boid);
    }
    if ( cause !== undefined ) {
      this.onEvent({ type: cause, boid });
    }
  }

  // Faded away, eaten or removed: out of the lists and of the Quadtree
  private isGone(boid: Boid): boolean {
    return boid.isDead && boid.alpha <= 0.01;
  }

  // A dead boid slows down and fades away, then it is removed
  private fadeAway(boid: Boid) {
    boid.velocity.x *= 0.98;
    boid.velocity.y *= 0.98;

    if ( boid.preyLink !== null ) {
      // Remove the prey mark if any
      boid.preyLink.preyLink = null;
    }

    boid.alpha = Math.max(0, boid.alpha - 0.01);

    if ( boid.alpha <= 0.01 ) {
      boid.quadtree.remove(boid);
      if ( boid.isPredator ) {
        this.predators = this.predators.filter(predator => predator !== boid);
      } else {
        this.boids = this.boids.filter(other => other !== boid);
      }
    }
  }

  private moveBoid(boid: Boid, avoidBorders: Point) {
    const boidsLargestRadius = Math.max(
      this.alignmentRadius,
      this.cohesionRadius,
      this.boidsSeparationRadius,
      this.reproductionRadius
    );

    const nearbyBoids = boid.quadtree.rangeQuery( boid, boidsLargestRadius, this.rangeQueryCap );
    // The vision of a boid sets how far it sees the predators
    const sight = this.sightRadius(boid);
    let nearbyPredators: Boid[] = [];
    if ( this.fleeFactor != 0 ) {
      nearbyPredators = boid.quadtree.rangeQuery( boid, sight, this.rangeQueryCap, true );
    }

    // Alignment, cohesion and separation with nearby boids
    const { alignment, cohesion, separation } = this.calculateFlock(boid, nearbyBoids);

    boid.reproductionCooldown = Math.max ( 0, Math.min(boid.reproductionCooldown - 1, boid.genome.reproductionRate * (11 - this.boidReproductionModificator)/10  ));

    // Check for quiet times and proximity for reproduction
    if ( this.isReadyToNest(boid) ) {
      this.tryToReproduce(boid);
      cohesion.x *= 1.2;
      cohesion.y *= 1.2;
      separation.x /= 1.2;
      separation.y /= 1.2;
    }

    // Flee predators: Move away from nearby predators
    const fleePredators = this.fleePredators(boid, nearbyPredators, sight);

    // Check if the flee force is below a certain threshold
    const fleeForceMagnitudeSquared = fleePredators.x ** 2 + fleePredators.y ** 2;

    if (fleeForceMagnitudeSquared < (this.fleeForceThreshold ** 2 * (1.1 + this.boidReproductionModificator / 10))) {
      // Increment the quiet time counter
      boid.predationCounter++;
    } else if ( this.fleeReset ) {
      // Reset the quiet time counter since the boid is actively fleeing predators
      boid.predationCounter = 0;
    }

    // Steer away from the obstacles drawn with the mouse
    const avoidObstacles = this.avoidObstacles(boid);

    // Eat the plankton where the boid is, and look for more, all the more when hungry
    const seekFood = { x: 0, y: 0 };
    if ( this.foodEnabled ) {
      boid.energy += this.food.eat(boid.position, Math.min(this.eatQuantity, 1 - boid.energy));
      const attraction = (this.grazingAttraction + 1 - boid.energy) * this.foodAttraction;
      const gradient = this.food.gradient(boid.position);
      seekFood.x = gradient.x * attraction;
      seekFood.y = gradient.y * attraction;

      // The closest alga in sight is nibbled when the boid is on it, or sought, all the more when hungry
      const plant = this.plantsEnabled ? this.plants.closest(boid.position, this.plantSight) : null;
      if ( plant !== null ) {
        const toPlant = { x: plant.x - boid.position.x, y: plant.y - boid.position.y };
        const distance = Math.sqrt(toPlant.x ** 2 + toPlant.y ** 2);
        if ( distance <= this.plants.radius(plant) ) {
          boid.energy += this.plants.eat(plant, Math.min(this.eatQuantity, 1 - boid.energy));
        } else {
          seekFood.x += toPlant.x / distance * attraction;
          seekFood.y += toPlant.y / distance * attraction;
        }
      }
    }

    let velocityChangeX = (separation.x + alignment.x + cohesion.x + avoidBorders.x + fleePredators.x * this.fleeFactor + avoidObstacles.x * this.obstacleAvoidanceForce + seekFood.x);
    let velocityChangeY = (separation.y + alignment.y + cohesion.y + avoidBorders.y + fleePredators.y * this.fleeFactor + avoidObstacles.y * this.obstacleAvoidanceForce + seekFood.y);

    // Limit the maximum steering force
    const totalForceSquared = velocityChangeX ** 2 + velocityChangeY ** 2;
    if (totalForceSquared > this.boidMaxSteeringForce ** 2) {
      const ratio = this.boidMaxSteeringForce / Math.sqrt(totalForceSquared);
      velocityChangeX *= ratio;
      velocityChangeY *= ratio;
    }

    // Update velocity based on the rules
    boid.velocity.x += velocityChangeX;
    boid.velocity.y += velocityChangeY;

    // Limit the velocity to a maximum value to prevent unrealistic speeds
    const speedSquared = (boid.velocity.x ** 2 + boid.velocity.y ** 2);
    if (speedSquared > boid.genome.maxVelocity ** 2) {
      const ratio = boid.genome.maxVelocity / Math.sqrt(speedSquared);
      boid.velocity.x *= ratio;
      boid.velocity.y *= ratio;
    }

    // Living, swimming and seeing cost energy: swimming fast costs much more, and good eyes cost too,
    // while a big body lasts longer. A boid without energy starves to death
    if ( this.foodEnabled ) {
      const relativeSpeedSquared = Math.min(speedSquared, boid.genome.maxVelocity ** 2) / this.boidMaxVelocity ** 2;
      const eyes = this.boidEyesCost * this.geneCostFactor * (boid.genome.vision ** 2 - 1);
      const spent = Math.max(0, this.boidBaseMetabolism + this.boidSwimCost * relativeSpeedSquared + eyes);
      boid.energy -= spent / this.endurance(boid);
      if ( boid.energy <= 0 ) {
        boid.energy = 0;
        this.kill(boid, 'starved');
      }
    }
  }

  private movePredator(boid: Boid, avoidBorders: Point) {
    const nearbyPredators = boid.quadtree.rangeQuery( boid, this.predatorsSeparationRadius, this.rangeQueryCap, true );

    // Separation: Move away from other predators that are too close
    const separation = this.calculatePredatorSeparation(boid, nearbyPredators, this.predatorsSeparationRadius);

    let chase = { x: 0, y: 0 };
    let maxVelocity = boid.genome.maxVelocity;
    let maxSteeringForce = this.predatorMaxSteeringForce;

    const speedBeforeSquared = (boid.velocity.x ** 2 + boid.velocity.y ** 2);

    if ( boid.reproductionCooldown == 0 ) {

      if (boid.predationCounter >= ( this.starvationThreshold * ( 11 + this.predatorStarvationModificator )/10 * boid.geneCost ) ) {
        this.kill(boid, 'predatorStarved');
      } else {

        let closestBoid = boid.preyLink;
        if ( closestBoid !== null && !this.canSee(boid, closestBoid) ) {
          closestBoid = null;
        }
        if ( this.predatorVersatility || closestBoid === null ) {
          closestBoid = this.findVisiblePrey(boid);
        }

        if ( closestBoid !== null ) {
          const closestBoidPosition = { x: closestBoid.position.x, y: closestBoid.position.y };

          // Check if the predator has caught the boid
          if ( this.calculateDistanceSquared(boid.position, closestBoidPosition) < this.captureDistance**2 ) {
            this.devour(closestBoid, boid);

            if ( Math.random() <= this.predatorReproductionChances/100 && this.totalBoids >= this.preyPerPredator * this.totalPredators ) {
              this.giveBirth ( boid );
            }

            boid.reproductionCooldown = boid.genome.reproductionRate;
            boid.predationCounter = 0;
            boid.preyLink = null;
            boid.chased = null;
          } else if ( this.tiresOfTheChase(boid, closestBoid) ) {
            this.giveUpTheChase(boid, closestBoid);
          } else {
            if ( closestBoid.preyLink === null ) {
              // Remove the prey mark from the previous prey if it is different
              if ( boid.preyLink != null && boid.preyLink != closestBoid ) {
                boid.preyLink.preyLink = null;
              }
              // Mark the prey
              closestBoid.preyLink = boid;
              boid.preyLink = closestBoid;
            }
            // Update predator's velocity to move towards the closest boid
            closestBoidPosition.x += closestBoid.velocity.x;
            closestBoidPosition.y += closestBoid.velocity.y;
            chase.x += (closestBoidPosition.x - boid.position.x) * boid.genome.maxVelocity;
            chase.y += (closestBoidPosition.y - boid.position.y) * boid.genome.maxVelocity;
          }
        }
      }

    } else {
      // Digesting: slower, paler, and less agile
      boid.reproductionCooldown = Math.max ( 0, Math.min(boid.reproductionCooldown - 1, boid.genome.reproductionRate * (11 - this.predatorReproductionModificator)/10  ));
      boid.alpha = Math.max ( boid.alpha * 0.99, 1 - Math.min(0.7, boid.reproductionCooldown/boid.genome.reproductionRate));
      maxVelocity = Math.max(Math.sqrt(speedBeforeSquared) * 0.99, boid.genome.maxVelocity / 3);
      if (avoidBorders.x === 0 && avoidBorders.y === 0) {
        maxSteeringForce /= 10;
      }
    }

    // Predators flee the Super Predators, whatever they were doing
    const threat = this.closestSuperPredator(boid);
    if ( threat !== null ) {
      const away = this.calculateDirection(threat.position, boid.position);
      chase = { x: away.x, y: away.y };
      maxVelocity = boid.genome.maxVelocity;
      maxSteeringForce = this.predatorMaxSteeringForce * 1.5;
    }

    if ( chase.x == 0 && chase.y == 0 && this.totalBoids != 0 ) {
      // Update predator's velocity to move towards the last Boid Birth Position
      chase.x += ((this.lastBoidBirthPosition.x - boid.position.x) + avoidBorders.x) * maxVelocity;
      chase.y += ((this.lastBoidBirthPosition.y - boid.position.y) + avoidBorders.y) * maxVelocity;
    }

    // Steer away from the obstacles: the chase grows with the distance to the prey, so does the avoidance,
    // otherwise a predator would press against a wall hiding its prey instead of keeping a small distance
    const avoidObstacles = this.avoidObstacles(boid);
    const avoidanceWeight = this.obstacleAvoidanceForce * Math.max(1, Math.sqrt(chase.x ** 2 + chase.y ** 2));

    let velocityChangeX = (separation.x + chase.x + avoidObstacles.x * avoidanceWeight);
    let velocityChangeY = (separation.y + chase.y + avoidObstacles.y * avoidanceWeight);

    // Limit the maximum steering force
    const totalForceSquared = velocityChangeX ** 2 + velocityChangeY ** 2;
    if (totalForceSquared > maxSteeringForce ** 2) {
      const ratio = maxSteeringForce / Math.sqrt(totalForceSquared);
      velocityChangeX *= ratio;
      velocityChangeY *= ratio;
    }

    // Update velocity based on the rules
    boid.velocity.x += velocityChangeX;
    boid.velocity.y += velocityChangeY;

    // Limit the velocity, and increase the starvation counter if the predator didn't eat
    const speedSquared = boid.velocity.x ** 2 + boid.velocity.y ** 2;
    if (speedSquared > maxVelocity ** 2) {
      const ratio = maxVelocity / Math.sqrt(speedSquared);
      boid.velocity.x *= ratio;
      boid.velocity.y *= ratio;
      if ( boid.reproductionCooldown == 0 ) {
        boid.predationCounter += boid.genome.maxVelocity;
      }
    } else if ( boid.reproductionCooldown == 0 ) {
      boid.predationCounter += Math.sqrt(speedSquared);
    }
  }

  // The obstacles hide the boids behind them
  private canSee(hunter: Boid, prey: Boid): boolean {
    return this.obstacles.isEmpty || !this.obstacles.blocks(hunter.position, prey.position);
  }

  // The closest prey not hidden by an obstacle: the closest ones are checked one by one, a few at most
  private findVisiblePrey(predator: Boid): Boid | null {
    const hidden = new Set<Boid>();
    const ignored = this.elapsedSteps < predator.ignoredUntil ? predator.ignoredPrey : null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const prey = predator.quadtree.findClosestRegularBoid(predator, this.predatorsCooperativeness, boid => boid !== ignored && !hidden.has(boid));
      if ( prey === null || this.canSee(predator, prey) ) {
        return prey;
      }
      hidden.add(prey);
    }
    return null;
  }

  // A prey turning sharper than its predator can lead it round in circles: the predator gets tired of a chase
  // that doesn't bring it closer, but keeps on as long as it gains ground
  private tiresOfTheChase(predator: Boid, prey: Boid): boolean {
    const distance = Math.sqrt(this.calculateDistanceSquared(predator.position, prey.position));
    if ( predator.chased !== prey ) {
      predator.chased = prey;
      predator.closestApproach = distance;
      predator.staleSteps = 0;
      return false;
    }
    if ( distance < predator.closestApproach - this.chaseProgress ) {
      predator.closestApproach = distance;
      predator.staleSteps = 0;
      return false;
    }
    return ++predator.staleSteps > this.chasePatience * this.stepsPerSecond;
  }

  // The prey given up is ignored for a while, the predator looks for an easier one
  private giveUpTheChase(predator: Boid, prey: Boid) {
    predator.ignoredPrey = prey;
    predator.ignoredUntil = this.elapsedSteps + this.ignoreDuration * this.stepsPerSecond;
    predator.chased = null;
    if ( prey.preyLink === predator ) {
      prey.preyLink = null;
    }
    if ( predator.preyLink === prey ) {
      predator.preyLink = null;
    }
    this.onEvent({ type: 'gaveUp', boid: predator, other: prey });
  }

  // A Super Predator hunts the closest boid or predator, until its lifetime is over
  private moveSuperPredator(superPredator: Boid, avoidBorders: Point) {
    superPredator.age++;
    if ( superPredator.age >= this.superPredatorLifetime * this.stepsPerSecond ) {
      this.kill(superPredator, 'superPredatorGone');
      return;
    }

    const steering = { x: avoidBorders.x, y: avoidBorders.y };
    const target = this.closestTargetOfSuperPredator(superPredator);
    if ( target !== null ) {
      if ( this.calculateDistanceSquared(superPredator.position, target.position) < this.superPredatorCaptureDistance ** 2 ) {
        this.devour(target, superPredator);
      } else {
        // It anticipates the movement of its target
        const direction = this.calculateDirection(superPredator.position, {
          x: target.position.x + target.velocity.x * 5,
          y: target.position.y + target.velocity.y * 5,
        });
        steering.x += direction.x;
        steering.y += direction.y;
      }
    }

    // Steer away from the obstacles, like the other predators
    const avoidObstacles = this.avoidObstacles(superPredator);
    steering.x += avoidObstacles.x * this.obstacleAvoidanceForce;
    steering.y += avoidObstacles.y * this.obstacleAvoidanceForce;

    // Limit the steering force, then the velocity
    const steeringSquared = steering.x ** 2 + steering.y ** 2;
    if ( steeringSquared > this.superPredatorMaxSteeringForce ** 2 ) {
      const ratio = this.superPredatorMaxSteeringForce / Math.sqrt(steeringSquared);
      steering.x *= ratio;
      steering.y *= ratio;
    }
    superPredator.velocity.x += steering.x;
    superPredator.velocity.y += steering.y;
    const speedSquared = superPredator.velocity.x ** 2 + superPredator.velocity.y ** 2;
    if ( speedSquared > superPredator.genome.maxVelocity ** 2 ) {
      const ratio = superPredator.genome.maxVelocity / Math.sqrt(speedSquared);
      superPredator.velocity.x *= ratio;
      superPredator.velocity.y *= ratio;
    }
  }

  private closestTargetOfSuperPredator(superPredator: Boid): Boid | null {
    let closest: Boid | null = null;
    let closestDistance = Infinity;
    for (const group of [this.boids, this.predators]) {
      for (const other of group) {
        if ( other.isDead || other.isSuper ) {
          continue;
        }
        const distance = this.calculateDistanceSquared(superPredator.position, other.position);
        if ( distance < closestDistance && this.canSee(superPredator, other) ) {
          closestDistance = distance;
          closest = other;
        }
      }
    }
    return closest;
  }

  // An eaten boid disappears at once, an eaten predator fades away
  private devour(target: Boid, hunter: Boid) {
    if ( target.preyLink !== null ) {
      target.preyLink.preyLink = null;
    }
    if ( target.isPredator ) {
      this.kill(target);
    } else {
      target.quadtree.remove(target);
      target.isDead = true;
      target.alpha = 0;
      this.boids = this.boids.filter(other => other !== target);
      this.rememberGenes(target);
    }
    this.onEvent({ type: 'caught', boid: hunter, other: target });
  }

  // The closest Super Predator a predator should flee, if any
  private closestSuperPredator(predator: Boid): Boid | null {
    let closest: Boid | null = null;
    let closestDistance = this.superFleeRadius ** 2;
    for (const other of this.predators) {
      if ( other.isSuper && !other.isDead ) {
        const distance = this.calculateDistanceSquared(predator.position, other.position);
        if ( distance < closestDistance ) {
          closestDistance = distance;
          closest = other;
        }
      }
    }
    return closest;
  }

  // Boids and predators steer away from the obstacles near them, the closer the stronger
  private avoidObstacles(boid: Boid): Point {
    const avoid = { x: 0, y: 0 };
    if ( this.obstacles.isEmpty ) {
      return avoid;
    }
    for (const segment of this.obstacles.near(boid.position)) {
      const closest = SegmentField.closestPoint(boid.position, segment);
      const distance = Math.sqrt(SegmentField.distanceSquared(boid.position, closest));
      if ( distance > 0 && distance < this.obstacleAvoidRadius ) {
        const weight = (1 - distance / this.obstacleAvoidRadius) / distance;
        avoid.x += (boid.position.x - closest.x) * weight;
        avoid.y += (boid.position.y - closest.y) * weight;
      }
    }
    return avoid;
  }

  // Currents carry the boids faster than they swim, and slowly turn them in their direction
  private currentFlow(boid: Boid): Point {
    const flow = { x: 0, y: 0 };
    if ( this.currents.isEmpty ) {
      return flow;
    }
    for (const segment of this.currents.near(boid.position)) {
      const closest = SegmentField.closestPoint(boid.position, segment);
      const distance = Math.sqrt(SegmentField.distanceSquared(boid.position, closest));
      if ( distance < this.currentRadius ) {
        const direction = this.calculateDirection(segment.a, segment.b);
        const weight = 1 - distance / this.currentRadius;
        flow.x += direction.x * weight;
        flow.y += direction.y * weight;
      }
    }
    const magnitude = Math.sqrt(flow.x ** 2 + flow.y ** 2);
    if ( magnitude === 0 ) {
      return flow;
    }
    // Near the joints of a line, the segments don't add up beyond the strength of the current
    const strength = this.currentStrength * Math.min(1, magnitude) / magnitude;
    flow.x *= strength;
    flow.y *= strength;
    if ( !boid.isDead ) {
      boid.velocity.x += flow.x * this.currentAlignment;
      boid.velocity.y += flow.y * this.currentAlignment;
    }
    return flow;
  }

  // Obstacles can't be crossed: a boid about to cross one slides along it instead
  private collideWithObstacles(boid: Boid, target: Point): Point {
    const start = boid.position;
    const segments = this.obstacles.near(start);
    const hit = segments.find(segment => SegmentField.crosses(start, target, segment));
    if ( hit === undefined ) {
      return target;
    }

    // Only the part of the move and of the velocity along the wall is kept
    const wall = this.calculateDirection(hit.a, hit.b);
    const along = (target.x - start.x) * wall.x + (target.y - start.y) * wall.y;
    const velocityAlong = boid.velocity.x * wall.x + boid.velocity.y * wall.y;
    boid.velocity = { x: wall.x * velocityAlong, y: wall.y * velocityAlong };

    // Pushed slightly away from the wall, on its own side, so it never ends up exactly on the line
    const away = this.calculateDirection(SegmentField.closestPoint(start, hit), start);
    const slid = { x: start.x + wall.x * along + away.x * 0.5, y: start.y + wall.y * along + away.y * 0.5 };
    return segments.some(segment => SegmentField.crosses(start, slid, segment)) ? { ...start } : slid;
  }

  dealWithDepletion() {
    // In Infinite mode, a few boids left can neither reproduce nor let the reinforcements come, so they arrive under a threshold
    const boidsDepleted = this.simulationMode === 'Infinite' ? this.totalBoids < this.infiniteMinBoids : this.totalBoids === 0;
    if ( !boidsDepleted && this.totalPredators !== 0 ) {
      return;
    }
    if ( this.simulationMode === 'DeathMatch' ) {
      this.pauseSimulation = true;
    } else if ( this.simulationMode === 'Retry' ) {
      this.initialize(this.width, this.height);
    } else if ( this.simulationMode === 'Infinite' ) {
      if ( boidsDepleted ) {
        // Enough reinforcements to get back above the threshold at once
        this.addReinforcements(false, Math.max(4, this.infiniteMinBoids - this.totalBoids, Math.min(100, this.totalPredators)));
      } else {
        this.addReinforcements(true, Math.max(2, Math.min(20, this.totalBoids / 20)));
      }
    }
  }

  // Reinforcements arrive one by one from random points of the borders, just inside the screen
  private addReinforcements(isPredator: boolean, count: number) {
    count = Math.ceil(count);
    const heritages = this.inheritGenes(isPredator, count);
    for (let i = 0; i < count; i++) {
      const position = Math.random() < 0.5
        ? { x: Math.random() < 0.5 ? 2 : this.width - 2, y: Math.random() * this.height }
        : { x: Math.random() * this.width, y: Math.random() < 0.5 ? 2 : this.height - 2 };
      const { genome, generation } = heritages[i];
      const reinforcement = this.insertNewBoid (
        position,
        { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        isPredator,
        genome,
        Math.random() * (isPredator ? this.predatorReproductionRate : this.boidReproductionRate),
        generation
      );
      // One event for the whole group
      if ( i === 0 && reinforcement !== null ) {
        this.onEvent({ type: 'reinforcement', boid: reinforcement });
      }
    }
  }

  // How far a boid sees the predators, from the option and its vision
  sightRadius(boid: Boid): number {
    return this.fleeRadius * boid.genome.vision;
  }

  // How long the energy of a boid lasts compared to the default: a big body holds more
  endurance(boid: Boid): number {
    return boid.size ** this.sizeEndurance;
  }

  private fleePredators(currentBoid: Boid, predators: Boid[], sight: number): Point {
    const fleePredatorsForce = { x: 0, y: 0 };
    const fleeRadiusSquared = sight ** 2;
    // The mouse acts as a predator
    const threats = this.mousePosition !== null ? [...predators.map(predator => predator.position), this.mousePosition] : predators.map(predator => predator.position);

    for (const threat of threats) {
      const distanceSquared = this.calculateDistanceSquared(currentBoid.position, threat);
      if (distanceSquared < fleeRadiusSquared && distanceSquared != 0) {
        const distance = Math.sqrt(distanceSquared);
        // Forces add up: being surrounded by several predators is scarier
        fleePredatorsForce.x += (currentBoid.position.x - threat.x) / distance;
        fleePredatorsForce.y += (currentBoid.position.y - threat.y) / distance;
      }
    }
    return fleePredatorsForce;
  }

  giveBirth ( parent: Boid, partner: Boid = parent ): Boid | null {
    // Crossover: each gene comes from one parent or the other, which keeps the diversity of the population
    const genome: Genome = {
      maxVelocity: (Math.random() < 0.5 ? parent : partner).genome.maxVelocity,
      reproductionRate: (Math.random() < 0.5 ? parent : partner).genome.reproductionRate,
      vision: (Math.random() < 0.5 ? parent : partner).genome.vision,
      lineage: (Math.random() < 0.5 ? parent : partner).genome.lineage,
    };

    this.varyAtBirth(genome, parent.isPredator);

    // Rare and larger mutations
    const evolutionChances = parent.isPredator ? this.predatorEvolutionChances/100 : this.boidEvolutionChances/100;
    const isMutant = Math.random() <= evolutionChances;
    if ( isMutant ) {
      this.mutate(genome, parent.isPredator);
    }

    const child = this.insertNewBoid (
      { x: parent.position.x, y: parent.position.y },
      { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
      parent.isPredator,
      genome,
      genome.reproductionRate * 2,
      Math.max(parent.generation, partner.generation) + 1,
      isMutant
    );

    if ( child !== null ) {
      this.onEvent({ type: 'birth', boid: child, other: parent });
      if ( isMutant ) {
        this.onEvent({ type: 'mutant', boid: child, other: parent });
      }
    }
    return child;
  }

  // Remember the genes of the last dead individuals, so the reinforcements of an extinct species can inherit them
  rememberGenes ( boid: Boid ) {
    const pool = boid.isPredator ? this.predatorGenePool : this.boidGenePool;
    pool.push({ genome: boid.genome, generation: boid.generation });
    if ( pool.length > this.genePoolSize ) {
      pool.shift();
    }
  }

  // Genes for a group of reinforcements: copied from living individuals, or from recently dead ones if the species is extinct
  // They are all picked before any insertion, otherwise the first reinforcement would be the only living source of the others
  inheritGenes ( isPredator: boolean, count: number ): Heritage[] {
    const living = isPredator ? this.predators.filter(predator => !predator.isDead && !predator.isSuper) : this.boids.filter(boid => !boid.isDead);
    const pool: Heritage[] = living.length > 0 ? living : (isPredator ? this.predatorGenePool : this.boidGenePool);
    return Array.from({ length: count }, () => {
      if ( pool.length === 0 ) {
        return { genome: this.createGenome(isPredator), generation: 0 };
      }
      const source = pool[Math.floor(Math.random() * pool.length)];
      return { genome: { ...source.genome }, generation: source.generation };
    });
  }

  // Default genome of the species, slightly varied so that natural selection has something to work on from the start
  // The predators don't have the vision gene, they see the whole screen
  createGenome ( isPredator: boolean ): Genome {
    const variation = (isPredator ? this.predatorEvolutionStep : this.boidEvolutionStep) / 100;
    const vary = (value: number) => value * (1 + (Math.random() * 2 - 1) * variation);
    return {
      maxVelocity: vary(isPredator ? this.predatorMaxVelocity : this.boidMaxVelocity),
      reproductionRate: vary(isPredator ? this.predatorReproductionRate : this.boidReproductionRate),
      vision: isPredator ? 1 : vary(1),
      lineage: (Math.random() * 2 - 1) * this.founderLineage,
    };
  }

  // The genes a species evolves
  private genes ( isPredator: boolean ): ('maxVelocity' | 'reproductionRate' | 'vision')[] {
    return isPredator ? ['maxVelocity', 'reproductionRate'] : ['maxVelocity', 'reproductionRate', 'vision'];
  }

  // Alter one random gene by one evolution step, for better or worse, within the evolution cap
  // The family color shifts too: the mutant starts a new lineage
  mutate ( genome: Genome, isPredator: boolean ) {
    const evolutionStep = (isPredator ? this.predatorEvolutionStep : this.boidEvolutionStep) / 100;
    const genes = this.genes(isPredator);
    const gene = genes[Math.floor(Math.random() * genes.length)];
    this.setGene(genome, gene, isPredator, genome[gene] * (Math.random() < 0.5 ? 1 + evolutionStep : 1 - evolutionStep));

    // Bounced back at both ends of the range of colors
    const lineage = genome.lineage + (Math.random() < 0.5 ? this.lineageStep : -this.lineageStep);
    genome.lineage = lineage > 1 ? 2 - lineage : lineage < -1 ? -2 - lineage : lineage;
  }

  // Small random variation of every gene at each birth, so natural selection always has some diversity to work on
  // The family color doesn't vary: only a mutant gets a new one
  private varyAtBirth ( genome: Genome, isPredator: boolean ) {
    const variation = this.birthVariation / 100;
    for (const gene of this.genes(isPredator)) {
      this.setGene(genome, gene, isPredator, genome[gene] * (1 + (Math.random() * 2 - 1) * variation));
    }
  }

  // Set a gene, kept within the evolution cap around the species default
  private setGene ( genome: Genome, gene: 'maxVelocity' | 'reproductionRate' | 'vision', isPredator: boolean, value: number ) {
    const evolutionCap = (isPredator ? this.predatorEvolutionCap : this.boidEvolutionCap) / 100;
    const defaultValue = gene === 'maxVelocity' ? (isPredator ? this.predatorMaxVelocity : this.boidMaxVelocity)
      : gene === 'reproductionRate' ? (isPredator ? this.predatorReproductionRate : this.boidReproductionRate)
      : 1;
    genome[gene] = Math.min(defaultValue * (1 + evolutionCap), Math.max(defaultValue * (1 - evolutionCap), value));
  }

  // Trade-off of the genes: faster or more fertile boids live shorter, more fertile predators starve faster
  // (fast predators already get hungry faster). With a cost above 1, the best genes depend on the predation:
  // boids that are eaten young gain from living fast, boids that die of old age gain from living long
  // Good eyes cost energy, without plankton they cost some life instead
  calculateGeneCost ( genome: Genome, isPredator: boolean ): number {
    const speed = isPredator ? 0 : genome.maxVelocity / this.boidMaxVelocity - 1;
    const fertility = 1 - genome.reproductionRate / (isPredator ? this.predatorReproductionRate : this.boidReproductionRate);
    const vision = isPredator || this.foodEnabled ? 0 : genome.vision - 1;
    return Math.max(this.minGeneCost, 1 - this.geneCostFactor * (speed + fertility + vision));
  }

  // The body size: a slow boid is bigger, a fast one smaller, within reasonable limits
  private bodySize ( speedTrait: number ): number {
    return Math.min(1.5, Math.max(0.6, 1 - this.sizeEffect * speedTrait * this.traitScale));
  }

  // Normalized deviation of a gene from its species default, in [-1, 1], used to color the boid
  private geneTrait ( value: number, defaultValue: number ): number {
    return Math.max(-1, Math.min(1, (value / defaultValue - 1) / this.traitScale));
  }

  // A boid added during the simulation (birth, reinforcement, click) is refused when the FPS is too low
  insertNewBoid ( position: Point, velocity: Point, isPredator: boolean, genome: Genome,
    reproductionCooldown: number, generation: number = 0, isMutant: boolean = false ): Boid | null {
    if ( this.errorFadeOut > 0 && !this.pauseSimulation ) {
      return null;
    }
    if ( this.fps < this.minFPS ) {
      this.errorMessage = 'Boid not created, FPS too low !';
      this.errorFadeOut = 50;
      this.dealWithLowFPS();
      return null;
    }
    return this.createBoid(position, velocity, isPredator, genome, reproductionCooldown, generation, isMutant);
  }

  // A boid of the initial population is always created, whatever the FPS at that moment
  private createBoid ( position: Point, velocity: Point, isPredator: boolean, genome: Genome,
    reproductionCooldown: number, generation: number = 0, isMutant: boolean = false ): Boid {
    const speedTrait = this.geneTrait(genome.maxVelocity, isPredator ? this.predatorMaxVelocity : this.boidMaxVelocity);
    const boid: Boid = {
      position: position,
      velocity: velocity,
      genome: genome,
      speedTrait: speedTrait,
      size: this.bodySize(speedTrait),
      isPredator: isPredator,
      isSuper: false,
      generation: generation,
      isMutant: isMutant,
      age: 0,
      lifespanFactor: 0.8 + Math.random() * 0.4,
      geneCost: this.calculateGeneCost(genome, isPredator),
      energy: 0.8,
      isDead: false,
      reproductionCooldown: reproductionCooldown,
      predationCounter: 0,
      alpha: 1,
      quadtree: this.quadtree,
      preyLink: null,
      chased: null,
      closestApproach: Infinity,
      staleSteps: 0,
      ignoredPrey: null,
      ignoredUntil: 0,
      trail: []
    };

    this.quadtree.insert(boid);

    if (isPredator) {
      this.predators.push(boid);
    } else {
      this.boids.push(boid);
      this.lastBoidBirthPosition = position;
    }
    return boid;
  }

  // A Super Predator doesn't evolve nor reproduce, it hunts for a while then fades away
  addSuperPredator(position: Point): Boid | null {
    const superPredator = this.insertNewBoid (
      position,
      { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
      true,
      { maxVelocity: this.superPredatorMaxVelocity, reproductionRate: this.predatorReproductionRate, vision: 1, lineage: 0 },
      0
    );
    if ( superPredator !== null ) {
      // Its size doesn't come from its speed: it is drawn bigger than any predator
      superPredator.isSuper = true;
      superPredator.size = 1;
      this.onEvent({ type: 'superPredator', boid: superPredator });
    }
    return superPredator;
  }

  // Remove the boids (they fade away), and the parts of the obstacles, currents and plankton within the radius
  erase(center: Point, radius: number) {
    const radiusSquared = radius ** 2;
    for (const boid of [...this.boids, ...this.predators]) {
      if ( !boid.isDead && this.calculateDistanceSquared(boid.position, center) < radiusSquared ) {
        this.kill(boid, 'erased');
      }
    }
    this.obstacles.erase(center, radius);
    this.currents.erase(center, radius);
    this.food.erase(center, radius);
    this.plants.erase(center, radius);
  }

  clearDrawings() {
    this.obstacles.clear();
    this.currents.clear();
  }

  private dealWithLowFPS() {
    if ( this.lowFPSAction == 'PopulationControl' ) {
      if ( this.totalBoids < this.totalPredators * 5 ) {
        this.removeBoids(Math.floor(this.totalPredators * 0.05), this.predators);
      } else {
        this.removeBoids(Math.floor(this.totalBoids * 0.05), this.boids);
      }
    } else if ( this.lowFPSAction == 'BudgetCuts' ) {
      this.removeBoids(Math.floor(this.totalPredators / 2), this.predators);
      this.removeBoids(Math.floor(this.totalBoids / 2), this.boids);
    }
  }

  private removeBoids (numberToRemove: number, listOfBoids: Boid[]) {
    for (let i = 0; i < numberToRemove && listOfBoids.length > 0; i++) {
      const boidToRemove = listOfBoids.shift()!;
      boidToRemove.quadtree.remove(boidToRemove);
      boidToRemove.isDead = true;
      boidToRemove.alpha = 0;
      if ( !boidToRemove.isSuper ) {
        this.rememberGenes(boidToRemove);
      }
    }
  }

  private tryToReproduce(boid: Boid) {
    const reproductionRadiusSquared = this.reproductionRadius**2;
    const reproductionPartners = this.boids.filter(otherBoid => {
      if ( otherBoid === boid || otherBoid.isDead ) {
        return false;
      }
      const distanceSquared = this.calculateDistanceSquared(boid.position, otherBoid.position);
      return (
        distanceSquared < reproductionRadiusSquared &&
        this.areVelocitiesSimilar(boid.velocity, otherBoid.velocity) &&
        this.isReadyToNest(otherBoid)
      );
    });

    if ( reproductionPartners.length === 0 ) {
      return;
    }
    const partner = reproductionPartners[Math.floor(Math.random() * reproductionPartners.length)];

    // Logistic growth: the more crowded the screen, the lower the chances, down to 0 at its carrying capacity
    const carryingCapacity = this.width * this.height / this.areaPerBoid;
    const crowding = Math.max(0, 1 - this.boids.length / carryingCapacity);
    if ( Math.random() <= this.boidReproductionChances/100 * crowding ) {
      const child = this.giveBirth ( boid, partner );
      // A birth costs energy to both parents, the child starts with it
      if ( child !== null && this.foodEnabled ) {
        boid.energy -= this.birthEnergyCost;
        partner.energy -= this.birthEnergyCost;
        child.energy = 2 * this.birthEnergyCost;
      }
    }

    boid.reproductionCooldown = boid.genome.reproductionRate * (11 - this.boidReproductionModificator)/10;
    partner.reproductionCooldown = partner.genome.reproductionRate * (11 - this.boidReproductionModificator)/10;
    boid.predationCounter = partner.predationCounter = 0; // Reset quiet time for both parents
  }

  // A regular boid can nest after a quiet time and a cooldown, both shortened by its fertility gene, and with enough energy
  isReadyToNest(boid: Boid): boolean {
    const fertilityRatio = boid.genome.reproductionRate / this.boidReproductionRate;
    return boid.reproductionCooldown === 0 &&
      ( !this.foodEnabled || boid.energy >= this.reproductionEnergy ) &&
      boid.predationCounter >= this.reproductionThreshold * (11 - this.boidReproductionModificator)/10 * fertilityRatio;
  }

  private areVelocitiesSimilar(velocity1: Point, velocity2: Point): boolean {
    const dotProduct = velocity1.x * velocity2.x + velocity1.y * velocity2.y;
    const magnitudesProduct = Math.sqrt(velocity1.x ** 2 + velocity1.y ** 2) * Math.sqrt(velocity2.x ** 2 + velocity2.y ** 2);
    if ( magnitudesProduct === 0 ) {
      return false;
    }
    // Clamp to avoid NaN from floating point rounding
    const cosineSimilarity = Math.max(-1, Math.min(1, dotProduct / magnitudesProduct));
    return Math.acos(cosineSimilarity) < this.partnerAngleThreshold;
  }

  private calculatePredatorSeparation(currentBoid: Boid, boids: Boid[], separationRadius: number): Point {
    const separation = { x: 0, y: 0 };
    const separationRadiusSquared = separationRadius**2;

    for (const otherBoid of boids) {
      if (otherBoid !== currentBoid) {
        const distanceSquared = this.calculateDistanceSquared(currentBoid.position, otherBoid.position);
        if (distanceSquared < separationRadiusSquared && distanceSquared != 0) {
          const distance = Math.sqrt(distanceSquared);
          separation.x += (currentBoid.position.x - otherBoid.position.x) / distance;
          separation.y += (currentBoid.position.y - otherBoid.position.y) / distance;
        }
      }
    }
    return separation;
  }

  private calculateFlock(currentBoid: Boid, boids: Boid[]) {
    const averageVelocity = { x: 0, y: 0 };
    let totalBoidsForVelocity = 0;
    const averagePosition = { x: 0, y: 0 };
    let totalBoidsForDirection = 0;
    let direction = { x: 0, y: 0 };
    const separation = { x: 0, y: 0 };
    const alignmentRadiusSquared = this.alignmentRadius**2;
    const cohesionRadiusSquared = this.cohesionRadius**2;
    const boidsSeparationRadiusSquared = this.boidsSeparationRadius**2;

    for (const otherBoid of boids) {
      if (otherBoid !== currentBoid) {
        const distanceSquared = this.calculateDistanceSquared(currentBoid.position, otherBoid.position);

        if (distanceSquared < alignmentRadiusSquared) {
          averageVelocity.x += otherBoid.velocity.x;
          averageVelocity.y += otherBoid.velocity.y;
          totalBoidsForVelocity++;
        }
        if (distanceSquared < cohesionRadiusSquared) {
          averagePosition.x += otherBoid.position.x;
          averagePosition.y += otherBoid.position.y;
          totalBoidsForDirection++;
        }
        if (distanceSquared < boidsSeparationRadiusSquared && distanceSquared != 0) {
          const distance = Math.sqrt(distanceSquared);
          separation.x += (currentBoid.position.x - otherBoid.position.x) / distance;
          separation.y += (currentBoid.position.y - otherBoid.position.y) / distance;
        }
      }
    }

    if (totalBoidsForVelocity > 0) {
      averageVelocity.x /= totalBoidsForVelocity;
      averageVelocity.y /= totalBoidsForVelocity;
    }

    if (totalBoidsForDirection > 0) {
      averagePosition.x /= totalBoidsForDirection;
      averagePosition.y /= totalBoidsForDirection;
      direction = this.calculateDirection(currentBoid.position, averagePosition);
    }

    return {
      alignment: averageVelocity,
      cohesion: direction,
      separation: separation
    };
  }

  calculateDistanceSquared(point1: Point, point2: Point): number {
    const diffX = point1.x - point2.x;
    const diffY = point1.y - point2.y;
    return (diffX **2 + diffY **2);
  }

  calculateDirection(from: Point, to: Point): Point {
    const diffX = to.x - from.x;
    const diffY = to.y - from.y;
    const distance = Math.sqrt(diffX * diffX + diffY * diffY);
    return distance > 0 ? { x: diffX / distance, y: diffY / distance } : { x: 0, y: 0 };
  }

  private avoidBorders(boid: Boid): Point {
    const avoid = { x: 0, y: 0 };
    if (boid.position.x < this.borderDistance) {
      avoid.x += this.borderAvoidanceForce;
    }
    if (boid.position.x > this.width - this.borderDistance) {
      avoid.x -= this.borderAvoidanceForce;
    }
    if (boid.position.y < this.borderDistance) {
      avoid.y += this.borderAvoidanceForce;
    }
    if (boid.position.y > this.height - this.borderDistance) {
      avoid.y -= this.borderAvoidanceForce;
    }
    return avoid;
  }
}
