import { Component, OnInit, ElementRef } from '@angular/core';
import { Quadtree } from '../classes/Quadtree';

interface Boid {
  position: { x: number, y: number };
  velocity: { x: number, y: number };
  maxVelocity: number;
  isPredator: boolean;
  isEvolved: boolean;
  alpha: number;
  isDead: boolean;
  reproductionRate: number;
  reproductionCooldown: number;
  predationCounter: number; // predationCounter is time without predation for boids, and time without predating for predators
  quadtree: Quadtree;
  preyLink : Boid | null;   // for Regular Boids, the Predator that chase them, for Predators, the prey !
}

interface Point {
  x: number;
  y: number;
}

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.sass'],
})

export class MainComponent implements OnInit {
  boids: Boid[] = [];
  numberOfBoids = 150;                // number of boids created when the simulation starts
  boidReproductionRate = 300;         // delay before a boid can reproduce again - can be modified by evolution and by the input boidReproductionModificator
  reproductionThreshold = 1000;       // needed quiet time to nest - can be modified by the input boidReproductionModificator
  reproductionRadius = 20;            // radius to find a partner (needed to reproduce for regular Boids only)
  boidReproductionChances = 10;       // percentage of chances to reproduce - can be modified by the user
  boidEvolutionChances = 5;           // chances for the child to evolve - can be modified by the user
  boidEvolutionStep = 5;              // size of steps of evolution modification in percent
  boidEvolutionCap = 50;              // maximum evolution modification in percent - can be modified by the user
  boidMaxVelocity = 2;                // maximum starting velocity of the boids - can be modified by evolution
  alignmentRadius = 30;               // radius to align with other boids - can be modified by the user
  cohesionRadius = 40;                // radius to join other boids - can be modified by the user
  boidsSeparationRadius = 20;         // radius to move from other boids - can be modified by the user
  borderDistance = 50;                // distance at which a boid start to avoid a border
  boidMaxSteeringForce = 0.1;         // maximum force to change direction
  borderAvoidanceForce = 5;           // factor to avoid screen borders
  fleeRadius = 60;                    // distance at which a boid detects a predator - can be modified by the user
  fleeFactor = 5;                     // importance of the flee regarding other directionnal factors - can be modified by the user
  fleeForceThreshold = 0.2;           // maximum fleeing force to have a quiet time - can be modified by the input boidReproductionModificator
  fleeReset = false;                  // does the fleeing process restarts the quiet time to 0
  lastBoidBirthPosition =  { x: 0, y: 0 };
  
  predators: Boid[] = [];
  numberOfPredators = 3;              // number of predators created when the simulation starts
  predatorReproductionRate = 300;     // delay before a predator can reproduce again - can be modified by evolution and by the input predatorReproductionModificator
  predatorReproductionChances = 10;   // percentage of chances to reproduce - can be modified by the user
  predatorEvolutionChances = 5;       // chances for the child to evolve - can be modified by the user
  predatorEvolutionStep = 5;          // size of steps of evolution modification in percent
  predatorEvolutionCap = 50;          // maximum evolution modification in percent - can be modified by the user
  predatorMaxSteeringForce = 0.12;    // maximum force to change direction
  predatorsSeparationRadius = 50;     // radius to move from other boids - can be modified by the user
  predatorMaxVelocity = 2.5;          // maximum velocity of the chasing predator - can be modified by evolution
  starvationThreshold = 1000;         // delay before a predator starves to death - can be modified by the input predatorStarvationModificator
  captureDistance = 5;                // distance to get to eat a boid
  predatorsCooperativeness = true;    // Do Predator cooperative to chase different preys
  predatorVersatility = true;         // Can predators change prey after choosing one

  mousePosition = { x: 0, y: 0 };
  containerWidth = 0;
  containerHeight = 0;
  totalBoids: number = 0;
  totalPredators: number = 0;

  addOnClick: string = 'predator';
  boidOptionsVisible: boolean = false;
  predatorOptionsVisible: boolean = false;
  displayOptionsVisible: boolean = false;
  simulationOptionsVisible: boolean = false;
  errorMessage = "";
  errorFadeOut = 0;
  pauseSimulation = false;
  drawQuadtree = true;
  displayQuadtreeCount = true;
  displayFPSCount = false;
  displayBoidCount = true;
  darkMode = false;
  simulationMode = "Infinite";
  lowFPSAction = "PopulationControl";
  boidReproductionModificator = 0;        // increase or decrease the reproduction rate for Boids
  predatorReproductionModificator = 0;    // increase or decrease the reproduction rate for Predators
  predatorStarvationModificator = 0;      // increase or decrease the starvation resistance for Predators

  fps = 30;
  minFPS = 20;
  private fpsValues: number[] = [];
  private lastFrameTime = performance.now();
  private fpsUpdateInterval: number = 100;

  updateFPS(timestamp: number) {
    const elapsed = timestamp - this.lastFrameTime;
    const fps = 1000 / elapsed;
  
    this.fpsValues.push(fps);
  
    // Check if the update interval has passed
    if (elapsed > this.fpsUpdateInterval) {
      // Calculate average FPS
      this.fps = Math.round(this.calculateAverageFPS());
      this.errorFadeOut = Math.max(0, this.errorFadeOut - 1);
      if ( this.fps >= this.minFPS && this.errorFadeOut == 0 ) {
        this.errorMessage = "";
      }
  
      // Reset values for the next interval
      this.fpsValues = [];
      this.lastFrameTime = timestamp;
    }
  }
  
  calculateAverageFPS(): number {
    if (this.fpsValues.length === 0) {
      return 0;
    }
  
    const totalFPS = this.fpsValues.reduce((sum, fps) => sum + fps, 0);
    const averageFPS = totalFPS / this.fpsValues.length;
  
    return averageFPS;
  }

  quadtree!: Quadtree;
  rangeQueryCap = 6;                            // number of neighboring boids each individual relies onto
  finalQuadtreeList: Quadtree[] = [this.quadtree];
  constructor(private el: ElementRef) {}

  ngOnInit(): void {
    this.initializeSimulation();
    
    // Start the animation loop
    this.updateBoids(performance.now());
  }

  restartSimulation(): void {
    this.initializeSimulation();
  }

  initializeSimulation() {

    document.addEventListener('mousemove', (event) => this.handleMouseMove(event));
    document.addEventListener('click', (event) => this.handleMouseClick(event));

    // Get the dimensions of the boid container
    const boidContainer = this.el.nativeElement.querySelector('.boid-container');
    this.containerWidth = boidContainer.offsetWidth;
    this.containerHeight = boidContainer.offsetHeight;
    this.quadtree = new Quadtree( 0, 0, this.containerWidth, this.containerHeight, 24 );
    this.finalQuadtreeList = [this.quadtree];
    this.boids = [];
    this.predators = [];

    // Initialize boids with random positions and velocities
    for (let i = 0; i < this.numberOfBoids; i++) {
      this.insertNewBoid (
        { x: Math.random() * this.containerWidth, y: Math.random() * this.containerHeight },
        { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        this.boidMaxVelocity,
        false,
        this.boidReproductionRate,
        Math.random() * this.boidReproductionRate,
        this.quadtree
      );
    }

    // Initialize predators with random positions, velocities, and reproduction rate
    for (let i = 0; i < this.numberOfPredators; i++) {
      this.insertNewBoid (
        { x: Math.random() * this.containerWidth, y: Math.random() * this.containerHeight },
        { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        this.predatorMaxVelocity,
        true,
        this.predatorReproductionRate,
        Math.random() * this.predatorReproductionRate,
        this.quadtree
      );
    }
  }
  
  handleFormClick(event: MouseEvent) {
    event.stopPropagation(); // Prevent the event from propagating down
  }
  
  togglePause() {
    this.pauseSimulation = !this.pauseSimulation;
    const pauseText = document.getElementById(`pauseSimulation`);
    if (this.pauseSimulation) {
      pauseText!.textContent = "Resume Simulation";
    } else {
      pauseText!.textContent = "Pause Simulation";
    }
  }
  
  toggleOptions(optionsType: string) {
    (this as any)[`${optionsType.toLowerCase()}OptionsVisible`] = !(this as any)[`${optionsType.toLowerCase()}OptionsVisible`];
  
    const toggleOptionsButton = document.getElementById(`toggle${optionsType}OptionsButton`);
  
    // Toggle the visibility of the hidden options
    if (toggleOptionsButton) {
      if ((this as any)[`${optionsType.toLowerCase()}OptionsVisible`]) {
        toggleOptionsButton.textContent = `Hide ${optionsType} Options`;
      } else {
        toggleOptionsButton.textContent = `Show ${optionsType} Options`;
      }
    }
  }
  

  // Handle mouse movement
  handleMouseMove(event: MouseEvent) {
    // Update the mouse position based on the event
    this.mousePosition = { x: event.clientX, y: event.clientY };
  }

  handleMouseClick(event: MouseEvent) {
    let isPredator = false;
    let maxVelocity = this.boidMaxVelocity;
    let reproductionRate = this.boidReproductionRate;
    if ( this.addOnClick == "predator") {
      isPredator = true;
      maxVelocity = this.predatorMaxVelocity;
      reproductionRate = this.predatorReproductionRate;
    }
    // Create a new boid at the mouse click position
    this.insertNewBoid (
      { x: event.clientX, y: event.clientY },
      { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
      maxVelocity,
      isPredator,
      reproductionRate,
      0,
      this.quadtree
    );
  }

  updateBoids(timestamp: number) {

    if ( this.pauseSimulation === false ) {

    if ( this.drawQuadtree == true ) {
      this.finalQuadtreeList = this.quadtree.retrieveFinalQuadtrees();
    }

    this.totalBoids = this.boids.length;
    this.totalPredators = this.predators.length;

    this.dealWithDepletion();

    const allBoids = [...this.boids, ...this.predators];

    // Boids behavior rules
    for (let boid of allBoids) {

      // Avoid borders: Redirect away from the borders
      let avoidBorders = this.avoidBorders(boid);

      if ( boid.isDead ) {

        // Gradually decrease velocity (you can adjust the rate)
        boid.velocity.x *= 0.98;
        boid.velocity.y *= 0.98;

        if ( boid.preyLink !== null ) {
          // Remove the prey mark if any
          boid.preyLink.preyLink = null;
        }
      
        // Gradually decrease alpha (transparency) (adjust the rate)
        boid.alpha = Math.max(0, boid.alpha - 0.01);

        if ( boid.alpha <= 0.01 ) {
          // Remove the starving predator
          boid.quadtree.remove(boid);
          this.predators = this.predators.filter(predator => predator !== boid);
        }

      } else if (!boid.isPredator) {

        const boidsLargestRadius = Math.max(
          this.alignmentRadius,
          this.cohesionRadius,
          this.boidsSeparationRadius,
          this.reproductionRadius
        );

        const nearbyBoids = boid.quadtree.rangeQuery( boid, boidsLargestRadius, this.rangeQueryCap );
        let nearbyPredators: Boid[] = [];
        if ( this.fleeFactor != 0 ) {
          nearbyPredators = boid.quadtree.rangeQuery( boid, this.fleeRadius, this.rangeQueryCap, true );
        }

        // Alignment: Align the velocity with the average velocity of nearby boids
        let { alignment, cohesion, separation } = this.calculateFlock(boid, nearbyBoids);

        boid.reproductionCooldown = Math.max ( 0, Math.min(boid.reproductionCooldown - 1, this.boidReproductionRate * (11 - this.boidReproductionModificator)/10  ));
        
        // Check for quiet times and proximity for reproduction
        if ( boid.predationCounter >= ( this.reproductionThreshold * (11 - this.boidReproductionModificator)/10 )
          && boid.reproductionCooldown == 0 ) {
          this.tryToReproduce(boid);
          cohesion.x *= 1.2;
          cohesion.y *= 1.2;
          separation.x /= 1.2;
          separation.y /= 1.2;
        }

        // Flee predators: Move away from nearby predators
        let fleePredators = this.fleePredators(boid, nearbyPredators);
        
        // Check if the flee force is below a certain threshold
        const fleeForceMagnitudeSquared = fleePredators.x ** 2 + fleePredators.y ** 2;

        if (fleeForceMagnitudeSquared < (this.fleeForceThreshold ** 2 * (1.1 + this.boidReproductionModificator / 10))) {
          // Increment the quiet time counter
          boid.predationCounter++;
        } else if ( this.fleeReset ) {
          // Reset the quiet time counter since the boid is actively fleeing predators
          boid.predationCounter = 0;
        }


        let velocityChangeX = (separation.x + alignment.x + cohesion.x + avoidBorders.x + fleePredators.x * this.fleeFactor);
        let velocityChangeY = (separation.y + alignment.y + cohesion.y + avoidBorders.y + fleePredators.y * this.fleeFactor);

        // Limit the maximum steering force
        const totalForceSquared = velocityChangeX ** 2 + velocityChangeY ** 2;

        // Compare with the squared maximum steering force
        if (totalForceSquared > this.boidMaxSteeringForce ** 2) {
          // Calculate the scaling ratio
          const ratio = this.boidMaxSteeringForce / Math.sqrt(totalForceSquared);

          // Scale the individual force components
          velocityChangeX *= ratio;
          velocityChangeY *= ratio;
        }


        // Update velocity based on the rules
        boid.velocity.x += velocityChangeX;
        boid.velocity.y += velocityChangeY;

        // Limit the velocity to a maximum value to prevent unrealistic speeds
        const speedSquared = (boid.velocity.x ** 2 + boid.velocity.y ** 2);
        if (speedSquared > boid.maxVelocity ** 2) {
          const ratio = boid.maxVelocity / Math.sqrt(speedSquared);
          boid.velocity.x *= ratio;
          boid.velocity.y *= ratio;
        }

      } else {

        const nearbyPredators = boid.quadtree.rangeQuery( boid, this.predatorsSeparationRadius, this.rangeQueryCap, true );

        // Separation: Move away from other predators that are too close
        let separation = this.calculatePredatorSeparation(boid, nearbyPredators, this.predatorsSeparationRadius);

        let chase = { x: 0, y: 0 };
        let maxVelocity = boid.maxVelocity;
        let maxSteeringForce = this.predatorMaxSteeringForce;
        
        // Limit the velocity to a maximum value to prevent unrealistic speeds
        const speedBeforeSquared = (boid.velocity.x ** 2 + boid.velocity.y ** 2);

        if ( boid.reproductionCooldown == 0 ) {

          if (boid.predationCounter! >= ( this.starvationThreshold * ( 11 + +this.predatorStarvationModificator )/10 ) ) {
            boid.isDead = true;
          } else {

            let closestBoid = boid.preyLink;
            if ( this.predatorVersatility || closestBoid === null ) {
              closestBoid = boid.quadtree.findClosestRegularBoid(boid, this.predatorsCooperativeness);
            }
            
            if ( closestBoid !== null ) {
              let closestBoidPosition = { x: closestBoid.position.x, y: closestBoid.position.y };

              // Check if the predator has caught the boid (arbitrary threshold for simplicity)
              if ( this.calculateDistanceSquared(boid.position, closestBoidPosition) < this.captureDistance**2 ) {
                  // Remove the captured boid
                  closestBoid.quadtree.remove(closestBoid);
                  this.boids = this.boids.filter(b => b !== closestBoid);
                  
                  if ( Math.random() <= this.predatorReproductionChances/100 ) {
                    this.giveBirth ( boid );
                  }

                  boid.reproductionCooldown = this.predatorReproductionRate;
                  boid.predationCounter = 0;
                  boid.preyLink = null;
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
                chase.x += (closestBoidPosition.x - boid.position.x) * boid.maxVelocity;
                chase.y += (closestBoidPosition.y - boid.position.y) * boid.maxVelocity;
              }
            }
          }

        } else {
          boid.reproductionCooldown = Math.max ( 0, Math.min(boid.reproductionCooldown - 1, this.predatorReproductionRate * (11 - this.predatorReproductionModificator)/10  ));          
          boid.alpha = Math.max ( boid.alpha * 0.99, 1 - Math.min(0.7, boid.reproductionCooldown/this.predatorReproductionRate));
          maxVelocity = Math.max(Math.sqrt(speedBeforeSquared) * 0.99, boid.maxVelocity / 3);
          if (avoidBorders.x === 0 && avoidBorders.y === 0) {
            maxSteeringForce /= 10;
          }
        }

        
        if ( chase.x == 0 && chase.y == 0 && this.totalBoids != 0 ) {
          // Update predator's velocity to move towards the last Boid Birth Position
          chase.x += ((this.lastBoidBirthPosition.x - boid.position.x) + avoidBorders.x) * maxVelocity;
          chase.y += ((this.lastBoidBirthPosition.y - boid.position.y) + avoidBorders.y) * maxVelocity;
        }

        let velocityChangeX = (separation.x + chase.x );
        let velocityChangeY = (separation.y + chase.y );

        // Limit the maximum steering force
        const totalForceSquared = velocityChangeX ** 2 + velocityChangeY ** 2;

        // Compare with the squared maximum steering force
        if (totalForceSquared > maxSteeringForce ** 2) {
          // Calculate the scaling ratio
          const ratio = maxSteeringForce / Math.sqrt(totalForceSquared);

          // Scale the individual force components
          velocityChangeX *= ratio;
          velocityChangeY *= ratio;
        }

        // Update velocity based on the rules
        boid.velocity.x += velocityChangeX;
        boid.velocity.y += velocityChangeY;
        
        // Limit the velocity to a maximum value to prevent unrealistic speeds
        const speedSquared = boid.velocity.x ** 2 + boid.velocity.y ** 2;
        if (speedSquared > maxVelocity ** 2) {
          const ratio = maxVelocity / Math.sqrt(speedSquared);
          boid.velocity.x *= ratio;
          boid.velocity.y *= ratio;
          if ( boid.reproductionCooldown == 0 && boid.isPredator ) {
            // Increase starvation counter if the predator didn't eat
            boid.predationCounter+= boid.maxVelocity;
          }
        } else if ( boid.reproductionCooldown == 0 && boid.isPredator ) {
          // Increase starvation counter if the predator didn't eat
          boid.predationCounter+= Math.sqrt(boid.velocity.x**2 + boid.velocity.y**2);
        }
        
      }
    
      // Update position based on velocity
      const newPosition: Point = { x: boid.position.x + boid.velocity.x, y: boid.position.y + boid.velocity.y };

      // Update the boid's position
      boid.quadtree.move( boid, newPosition );
      
    }
  }

    // Update FPS
    this.updateFPS(timestamp);
  
    // Call requestAnimationFrame to update the next frame
    requestAnimationFrame((nextTimestamp) => this.updateBoids(nextTimestamp));

  }

  dealWithDepletion() {
    if ( this.totalBoids === 0 || this.totalPredators === 0 ) {
      if ( this.simulationMode === "DeathMatch" ) {
        this.pauseSimulation = true;
      } else if ( this.simulationMode === "Retry" ) {
        this.restartSimulation();
      } else if ( this.simulationMode === "Infinite" ) {
        if ( this.totalBoids === 0 ) {
          const numberToAdd = Math.max(4,Math.min(100,this.totalPredators));
          // Add boids with random positions and velocities
          for (let i = 0; i < numberToAdd; i++) {
            // Determine whether the new boid should be placed on a vertical or horizontal boundary
            const onVerticalBoundary = Math.random() < 0.5;

            // Determine the position on the boundary
            let position;
            if (onVerticalBoundary) {
              // Place on the left or right boundary
              position = {
                x: Math.random() < 0.5 ? -5 : this.containerWidth + 5,
                y: Math.random() * this.containerHeight,
              };
            } else {
              // Place on the top or bottom boundary
              position = {
                x: Math.random() * this.containerWidth,
                y: Math.random() < 0.5 ? -5 : this.containerHeight + 5,
              };
            }
            this.insertNewBoid (
              position,
              { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
              this.boidMaxVelocity,
              false,
              this.boidReproductionRate,
              Math.random() * this.boidReproductionRate,
              this.quadtree
            );
          }
        } else {
          const numberToAdd = Math.max(2,Math.min(20,this.totalBoids/20));
          // Add boids with random positions and velocities
          for (let i = 0; i < numberToAdd; i++) {
            // Determine whether the new boid should be placed on a vertical or horizontal boundary
            const onVerticalBoundary = Math.random() < 0.5;

            // Determine the position on the boundary
            let position;
            if (onVerticalBoundary) {
              // Place on the left or right boundary
              position = {
                x: Math.random() < 0.5 ? -5 : this.containerWidth + 5,
                y: Math.random() * this.containerHeight,
              };
            } else {
              // Place on the top or bottom boundary
              position = {
                x: Math.random() * this.containerWidth,
                y: Math.random() < 0.5 ? -5 : this.containerHeight + 5,
              };
            }
            this.insertNewBoid (
              position,
              { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
              this.predatorMaxVelocity,
              true,
              this.predatorReproductionRate,
              Math.random() * this.predatorReproductionRate,
              this.quadtree
            );
          }
        }
      }
    }
  }

  fleePredators(currentBoid: Boid, predators: Boid[]): Point {
    
      const fleePredatorsForce = { x: 0, y: 0 };
      const fleeRadiusSquared = this.fleeRadius**2;

      for (let predator of predators) {
          const distanceSquared = this.calculateDistanceSquared(currentBoid.position, predator.position);

          if (distanceSquared < fleeRadiusSquared) {
              const diffX = currentBoid.position.x - predator.position.x;
              const diffY = currentBoid.position.y - predator.position.y;
              const distance = Math.sqrt(distanceSquared);
              fleePredatorsForce.x = diffX / distance;
              fleePredatorsForce.y = diffY / distance;
          }
      }

      const distanceSquared = this.calculateDistanceSquared(currentBoid.position, this.mousePosition);

      if (distanceSquared < fleeRadiusSquared && distanceSquared != 0) {
          const diffX = currentBoid.position.x - this.mousePosition.x;
          const diffY = currentBoid.position.y - this.mousePosition.y;
          const distance = Math.sqrt(distanceSquared);
          fleePredatorsForce.x = diffX / distance;
          fleePredatorsForce.y = diffY / distance;
      }

      return fleePredatorsForce;
  }

  giveBirth ( parent:Boid ) {
    let evolutionChances = 0;
    parent.isPredator ? evolutionChances = this.predatorEvolutionChances/100 : evolutionChances = this.boidEvolutionChances/100;
    let maxVelocity = parent.maxVelocity;
    let reproductionRate = parent.reproductionRate;
    let isEvolved = parent.isEvolved;

    if ( Math.random() <= evolutionChances ) {
      let evolutionStep = this.boidEvolutionStep/100;
      let evolutionCap = this.boidEvolutionCap/100;
      let defaultMaxVelocity = this.boidMaxVelocity;
      let defaultReproductionRate = this.boidReproductionRate;
      if ( parent.isPredator ) {
        evolutionStep = this.predatorEvolutionStep/100;
        evolutionCap = this.predatorEvolutionCap/100;
        defaultMaxVelocity = this.predatorMaxVelocity;
        defaultReproductionRate = this.predatorReproductionRate;
      }
      isEvolved = true;
      const evoli = Math.random() * 100;
      if ( evoli <= 50 ) {
        evoli%2==0 ?
        maxVelocity = Math.min(defaultMaxVelocity * (1+evolutionCap), maxVelocity*(1+evolutionStep)) :
        maxVelocity = Math.max(defaultMaxVelocity * (1-evolutionCap), maxVelocity*(1-evolutionStep));
      } else {
        evoli%2==0 ?
        reproductionRate = Math.min(defaultReproductionRate * (1+evolutionCap), reproductionRate*(1+evolutionStep)) :
        reproductionRate = Math.max(defaultReproductionRate * (1-evolutionCap), reproductionRate*(1-evolutionStep));
      }
    }
    
    this.insertNewBoid (
      { x: parent.position.x, y: parent.position.y },
      { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
      maxVelocity,
      parent.isPredator,
      reproductionRate,
      reproductionRate * 2,
      parent.quadtree,
      isEvolved
    );
  }

  insertNewBoid ( position: Point, velocity: Point, maxVelocity: number, isPredator: boolean, reproductionRate: number,
    reproductionCooldown: number, quadtree: Quadtree, isEvolved: boolean = false ) {
    if ( this.errorFadeOut == 0 || this.pauseSimulation ) {
      if ( this.fps >= this.minFPS  ) {
          
        const boid: Boid = {
          position: position,
          velocity: velocity,
          maxVelocity: maxVelocity,
          isPredator: isPredator,
          isEvolved: isEvolved,
          isDead: false,
          reproductionRate: reproductionRate,
          reproductionCooldown: reproductionCooldown,
          predationCounter: 0,
          alpha: 1,
          quadtree: quadtree,
          preyLink: null
        };
        
        // Insert boid into Quadtree
        quadtree.insert(boid);
        
        if (isPredator) {
          this.predators.push(boid);
        } else {
          this.boids.push(boid);
          this.lastBoidBirthPosition = position;
        }
      } else {
        this.errorMessage = "Boid not created, FPS too low !";
        this.errorFadeOut = 50;
        this.dealWithLowFPS();
      }
    }
  }

  dealWithLowFPS() {
    if ( this.lowFPSAction == "PopulationControl" ) {
      if ( this.totalBoids < this.totalPredators * 5 ) {
        this.removeBoids(Math.floor(this.totalPredators * 0.05), this.predators);
      } else {
        this.removeBoids(Math.floor(this.totalBoids * 0.05), this.boids);
      }
    } else if ( this.lowFPSAction == "BudgetCuts" ) {
      this.removeBoids(Math.floor(this.totalPredators / 2), this.predators);
      this.removeBoids(Math.floor(this.totalBoids / 2), this.boids);
    }
  }

  removeBoids (numberToRemove: number, listOfBoids: Boid[]) {
    for (let i = 0; i < numberToRemove; i++) {
      const boidToRemove = listOfBoids.shift();
      boidToRemove!.quadtree.remove(boidToRemove!);
    }
  }

  tryToReproduce(boid: Boid) {
    const reproductionRadiusSquared = this.reproductionRadius**2;
    const reproductionPartners = this.boids.filter(otherBoid => {
      const distanceSquared = this.calculateDistanceSquared(boid.position, otherBoid.position);
      return (
        distanceSquared < reproductionRadiusSquared &&
        this.areVelocitiesSimilar(boid.velocity, otherBoid.velocity) &&
        otherBoid.predationCounter >= ( this.reproductionThreshold * (11 - this.boidReproductionModificator)/10 ) &&
        otherBoid.reproductionCooldown === 0
      );
    });

    if ( reproductionPartners && reproductionPartners.length > 0 ) {
      
      const partner = reproductionPartners[Math.floor(Math.random() * reproductionPartners.length)];

      if ( Math.random() <= this.boidReproductionChances/100 ) {
        this.giveBirth ( boid );
      }

      boid.reproductionCooldown = partner.reproductionCooldown = this.boidReproductionRate * (11 - this.boidReproductionModificator)/10;
      boid.predationCounter = partner.predationCounter = 0; // Reset quiet time for both parents

    }
  }

  areVelocitiesSimilar(velocity1: { x: number, y: number }, velocity2: { x: number, y: number }): boolean {
    const angleThreshold = 0.1;
    const dotProduct = velocity1.x * velocity2.x + velocity1.y * velocity2.y;
    const magnitudesProduct = Math.sqrt(velocity1.x ** 2 + velocity1.y ** 2) * Math.sqrt(velocity2.x ** 2 + velocity2.y ** 2);
    const cosineSimilarity = dotProduct / magnitudesProduct;
    return Math.acos(cosineSimilarity) < angleThreshold;
  }

  calculatePredatorSeparation(currentBoid: Boid, boids: Boid[], separationRadius: number) {
    
    const separation = { x: 0, y: 0 };
    const separationRadiusSquared = separationRadius**2;

    for (let otherBoid of boids) {
      if (otherBoid !== currentBoid) {
        const distanceSquared = this.calculateDistanceSquared(currentBoid.position, otherBoid.position);

        if (distanceSquared < separationRadiusSquared && distanceSquared != 0) {
          const diffX = currentBoid.position.x - otherBoid.position.x;
          const diffY = currentBoid.position.y - otherBoid.position.y;
          const distance = Math.sqrt(distanceSquared);
          separation.x += diffX / distance;
          separation.y += diffY / distance;
        }
      }
    }
    return separation;
  }

  calculateFlock(currentBoid: Boid, boids: Boid[]) {
    const averageVelocity = { x: 0, y: 0 };
    let totalBoidsForVelocity = 0;
    const averagePosition = { x: 0, y: 0 };
    let totalBoidsForDirection = 0;
    let direction = { x: 0, y: 0 }
    const separation = { x: 0, y: 0 };
    const alignmentRadiusSquared = this.alignmentRadius**2;
    const cohesionRadiusSquared = this.cohesionRadius**2;
    const boidsSeparationRadiusSquared = this.boidsSeparationRadius**2;

    for (let otherBoid of boids) {
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
        if (distanceSquared < boidsSeparationRadiusSquared) {
          const diffX = currentBoid.position.x - otherBoid.position.x;
          const diffY = currentBoid.position.y - otherBoid.position.y;
          const distance = Math.sqrt(distanceSquared);
          separation.x += diffX / distance;
          separation.y += diffY / distance;
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

  calculateDistanceSquared(point1: Point, point2: Point) {
    const diffX = point1.x - point2.x;
    const diffY = point1.y - point2.y;
    return (diffX **2 + diffY **2);
  }
  
  calculateDirection(from: Point, to: Point) {
    const diffX = to.x - from.x;
    const diffY = to.y - from.y;
    const distance = Math.sqrt(diffX * diffX + diffY * diffY);

    if (distance > 0) {
      return { x: diffX / distance, y: diffY / distance } as Point;
    } else {
      return { x: 0, y: 0 } as Point;
    }
  }
  
  avoidBorders(boid: Boid): Point {
    const avoid = { x: 0, y: 0 };

    // Avoid left border
    if (boid.position.x < this.borderDistance) {
      avoid.x += this.borderAvoidanceForce;
    }
    // Avoid right border
    if (boid.position.x > this.containerWidth - this.borderDistance) {
      avoid.x -= this.borderAvoidanceForce;
    }
    // Avoid top border
    if (boid.position.y < this.borderDistance) {
      avoid.y += this.borderAvoidanceForce;
    }
    // Avoid bottom border
    if (boid.position.y > this.containerHeight - this.borderDistance) {
      avoid.y -= this.borderAvoidanceForce;
    }

    return avoid;
  }
}
