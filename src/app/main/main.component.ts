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
  numberOfBoids = 50;                 // number of boids created when the simulation starts
  boidReproductionRate = 500;         // delay before a boid can reproduce again - can be modified by evolution and by the input boidReproductionModificator
  reproductionThreshold = 1000;       // needed quiet time to nest - can be modified by the input boidReproductionModificator
  reproductionRadius = 20;            // radius to find a partner (needed to reproduce for regular Boids only)
  boidReproductionChances = 10;       // percentage of chances to reproduce - can be modified by the user
  boidEvolutionChances = 5;           // chances for the child to evolve - can be modified by the user
  boidEvolutionStep = 5;              // size of steps of evolution modification in percent
  boidEvolutionCap = 50;              // maximum evolution modification in percent - can be modified by the user
  boidMaxVelocity = 2;                // maximum starting velocity of the boids - can be modified by evolution
  alignmentRadius = 50;               // radius to align with other boids - can be modified by the user
  cohesionRadius = 50;                // radius to join other boids - can be modified by the user
  boidsSeparationRadius = 30;         // radius to move from other boids - can be modified by the user
  borderDistance = 50;                // distance at which a boid start to avoid a border
  boidMaxSteeringForce = 0.1;         // maximum force to change direction
  borderAvoidanceForce = 5;           // factor to avoid screen borders
  fleeRadius = 100;                   // distance at which a boid detects a predator
  fleeFactor = 1;                     // importance of the flee regarding other directionnal factors
  fleeForceThreshold = 0.2;           // maximum fleeing force to have a quiet time - can be modified by the input boidReproductionModificator
  fleeReset = false;                  // does the fleeing process restarts the quiet time to 0
  lastBoidBirthPosition =  { x: 0, y: 0 };
  
  predators: Boid[] = [];
  numberOfPredators = 2;              // number of predators created when the simulation starts
  predatorReproductionRate = 300;     // delay before a predator can reproduce again - can be modified by evolution and by the input predatorReproductionModificator
  predatorReproductionChances = 10;   // percentage of chances to reproduce - can be modified by the user
  predatorEvolutionChances = 5;       // chances for the child to evolve - can be modified by the user
  predatorEvolutionStep = 5;          // size of steps of evolution modification in percent
  predatorEvolutionCap = 50;          // maximum evolution modification in percent - can be modified by the user
  predatorMaxSteeringForce = 0.11;    // maximum force to change direction
  predatorsSeparationRadius = 50;     // radius to move from other boids - can be modified by the user
  predatorMaxVelocity = 2.4;          // maximum velocity of the chasing predator - can be modified by evolution
  starvationThreshold = 2000;         // delay before a predator starves to death - can be modified by the input predatorStarvationModificator
  captureDistance = 5;                // distance to get to eat a boid

  mousePosition = { x: 0, y: 0 };
  containerWidth = 0;
  containerHeight = 0;
  totalBoids: number = 0;
  totalPredators: number = 0;

  addOnClick: string = 'predator';
  optionsVisible: boolean = false;
  errorMessage = "";
  errorFadeOut = 0;
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
  constructor(private el: ElementRef) {}

  ngOnInit() {

    document.addEventListener('mousemove', (event) => this.handleMouseMove(event));
    document.addEventListener('click', (event) => this.handleMouseClick(event));

    // Get the dimensions of the boid container
    const boidContainer = this.el.nativeElement.querySelector('.boid-container');
    this.containerWidth = boidContainer.offsetWidth;
    this.containerHeight = boidContainer.offsetHeight;
    this.quadtree = new Quadtree( 0, 0, this.containerWidth, this.containerHeight, 10 );

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
    
    // Start the animation loop
    this.updateBoids(performance.now());
  }
  
  handleFormClick(event: MouseEvent) {
    event.stopPropagation(); // Prevent the event from propagating down
  }
  
  toggleOptions() {
    this.optionsVisible = !this.optionsVisible;
    var toggleOptionsButton = document.getElementById("toggleOptionsButton");
  
    // Toggle the visibility of the hidden options
    if (this.optionsVisible) {
      toggleOptionsButton!.textContent = "Hide Options";
    } else {
      toggleOptionsButton!.textContent = "Show Options";
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

    this.totalBoids = this.boids.length;
    this.totalPredators = this.predators.length;

    const allBoids = [...this.boids, ...this.predators];

    // Boids behavior rules
    for (let boid of allBoids) {

      // Avoid borders: Redirect away from the borders
      let avoidBorders = this.avoidBorders(boid);

      if (!boid.isPredator) {

        const boidsLargestRadius = Math.max(
          this.alignmentRadius,
          this.cohesionRadius,
          this.boidsSeparationRadius,
          this.reproductionRadius
        );

        const nearbyBoids = boid.quadtree.rangeQuery( boid, boidsLargestRadius );
        const nearbyPredators = boid.quadtree.rangeQuery( boid, this.fleeRadius, true );

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
        const fleeForceMagnitude = Math.sqrt(fleePredators.x ** 2 + fleePredators.y ** 2);
        
        if (fleeForceMagnitude < (this.fleeForceThreshold * (1.1 + this.boidReproductionModificator / 10))) {
          // Increment the quiet time counter
          boid.predationCounter++;
        } else if ( this.fleeReset ) {
          // Reset the quiet time counter since the boid is actively fleeing predators
          boid.predationCounter = 0;
        }

        let velocityChangeX = (separation.x + alignment.x + cohesion.x + avoidBorders.x + fleePredators.x * this.fleeFactor);
        let velocityChangeY = (separation.y + alignment.y + cohesion.y + avoidBorders.y + fleePredators.y * this.fleeFactor);

        // Limit the maximum steering force
        const totalForce = Math.sqrt( velocityChangeX ** 2 + velocityChangeY ** 2 );

        if (totalForce > this.boidMaxSteeringForce) {
          const ratio = this.boidMaxSteeringForce / totalForce;
          velocityChangeX *= ratio;
          velocityChangeY *= ratio;
        }

        // Update velocity based on the rules
        boid.velocity.x += velocityChangeX;
        boid.velocity.y += velocityChangeY;

        // Limit the velocity to a maximum value to prevent unrealistic speeds
        const speed = Math.sqrt(boid.velocity.x ** 2 + boid.velocity.y ** 2);
        if (speed > boid.maxVelocity) {
          const ratio = boid.maxVelocity / speed;
          boid.velocity.x *= ratio;
          boid.velocity.y *= ratio;
        }

      } else if ( boid.isDead ) {

        // Gradually decrease velocity (you can adjust the rate)
        boid.velocity.x *= 0.98;
        boid.velocity.y *= 0.98;
      
        // Gradually decrease alpha (transparency) (adjust the rate)
        boid.alpha = Math.max(0, boid.alpha - 0.01);

        if ( boid.alpha <= 0.01 ) {
          // Remove the starving predator
          boid.quadtree.remove(boid);
          this.predators = this.predators.filter(predator => predator !== boid);
        }

      } else {

        const nearbyPredators = boid.quadtree.rangeQuery( boid, this.predatorsSeparationRadius, true );

        // Separation: Move away from other predators that are too close
        let separation = this.calculatePredatorSeparation(boid, nearbyPredators, this.predatorsSeparationRadius);

        let chase = { x: 0, y: 0 };
        let maxVelocity = boid.maxVelocity;
        let maxSteeringForce = this.predatorMaxSteeringForce;
        
        // Limit the velocity to a maximum value to prevent unrealistic speeds
        const speedBefore = Math.sqrt(boid.velocity.x ** 2 + boid.velocity.y ** 2);

        if ( boid.reproductionCooldown == 0 ) {

          // Increase starvation counter if the predator didn't eat
          boid.predationCounter!+= Math.max(1, Math.sqrt(boid.velocity.x ** 2 + boid.velocity.y ** 2));
          if (boid.predationCounter! >= ( this.starvationThreshold * ( 11 + +this.predatorStarvationModificator )/10 ) ) {
            boid.isDead = true;
          } else {

            const closestBoid = boid.quadtree.findClosestRegularBoid(boid);

            if ( closestBoid !== null ) {
              let closestBoidPosition = { x: closestBoid.position.x, y: closestBoid.position.y };

              // Check if the predator has caught the boid (arbitrary threshold for simplicity)
              if ( this.calculateDistance(boid.position, closestBoidPosition) < this.captureDistance ) {
                  // Remove the captured boid
                  closestBoid.quadtree.remove(closestBoid);
                  this.boids = this.boids.filter(b => b !== closestBoid);
                  
                  if ( Math.random() <= this.predatorReproductionChances/100 ) {
                    this.giveBirth ( boid );
                  }

                  boid.reproductionCooldown = this.predatorReproductionRate;
                  boid.predationCounter = 0;
              } else {
                // Update predator's velocity to move towards the closest boid
                closestBoidPosition.x += closestBoid.velocity.x;
                closestBoidPosition.y += closestBoid.velocity.y;
                const direction = this.calculateDirection(boid.position, closestBoidPosition);
                chase.x += direction.x * boid.maxVelocity;
                chase.y += direction.y * boid.maxVelocity;
              }
            }
          }

        } else {
          boid.reproductionCooldown = Math.max ( 0, Math.min(boid.reproductionCooldown - 1, this.predatorReproductionRate * (11 - this.predatorReproductionModificator)/10  ));          
          boid.alpha = Math.max ( boid.alpha * 0.99, 1 - Math.min(0.7, boid.reproductionCooldown/this.predatorReproductionRate));
          maxVelocity = Math.max(speedBefore * 0.99, boid.maxVelocity / 3);
          if (avoidBorders.x === 0 && avoidBorders.y === 0) {
            maxSteeringForce /= 10;
          }
        }

        
        if ( chase.x == 0 && chase.y == 0 && this.totalBoids != 0 ) {
          // Update predator's velocity to move towards the last Boid Birth Position
          const direction = this.calculateDirection(boid.position, this.lastBoidBirthPosition);
          chase.x += (direction.x + avoidBorders.x) * maxVelocity;
          chase.y += (direction.y + avoidBorders.y) * maxVelocity;
        }

        let velocityChangeX = (separation.x + chase.x );
        let velocityChangeY = (separation.y + chase.y );

        // Limit the maximum steering force
        const totalForce = Math.sqrt( velocityChangeX ** 2 + velocityChangeY ** 2 );

        if (totalForce > maxSteeringForce) {
          const ratio = maxSteeringForce / totalForce;
          velocityChangeX *= ratio;
          velocityChangeY *= ratio;
        }

        // Update velocity based on the rules
        boid.velocity.x += velocityChangeX;
        boid.velocity.y += velocityChangeY;
        
        // Limit the velocity to a maximum value to prevent unrealistic speeds
        const speed = Math.sqrt(boid.velocity.x ** 2 + boid.velocity.y ** 2);
        if (speed > maxVelocity) {
          const ratio = maxVelocity / speed;
          boid.velocity.x *= ratio;
          boid.velocity.y *= ratio;
        }
        
      }
    
      // Update position based on velocity
      const newPosition: Point = { x: boid.position.x + boid.velocity.x, y: boid.position.y + boid.velocity.y };

      // Update the boid's position
      boid.quadtree.move( boid, newPosition );
      
    }

    // Update FPS
    this.updateFPS(timestamp);
  
    // Call requestAnimationFrame to update the next frame
    requestAnimationFrame((nextTimestamp) => this.updateBoids(nextTimestamp));

  }

  fleePredators(currentBoid: Boid, predators: Boid[]): Point {
    
      const fleePredatorsForce = { x: 0, y: 0 };

      for (let predator of predators) {
          const distance = this.calculateDistance(currentBoid.position, predator.position);

          if (distance < this.fleeRadius) {
              const diffX = currentBoid.position.x - predator.position.x;
              const diffY = currentBoid.position.y - predator.position.y;

              fleePredatorsForce.x = diffX / distance;
              fleePredatorsForce.y = diffY / distance;
          }
      }

      const distance = this.calculateDistance(currentBoid.position, this.mousePosition);

      if (distance < this.fleeRadius && distance != 0) {
          const diffX = currentBoid.position.x - this.mousePosition.x;
          const diffY = currentBoid.position.y - this.mousePosition.y;

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
    if ( this.errorFadeOut == 0 ) {
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
          quadtree: quadtree
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
      }
    }
  }

  tryToReproduce(boid: Boid) {
    const reproductionPartners = this.boids.filter(otherBoid => {
      const distance = this.calculateDistance(boid.position, otherBoid.position);
      return (
        distance < this.reproductionRadius &&
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

  findClosestBoid(currentBoid: Boid, boids: Boid[]): Boid | undefined {
      let closestBoid: Boid | undefined;
      let closestDistance = Number.MAX_VALUE;

      for (let otherBoid of boids) {
          const distance = this.calculateDistance(currentBoid.position, otherBoid.position);

          if (distance < closestDistance) {
              closestDistance = distance;
              closestBoid = otherBoid;
          }
      }

      return closestBoid;
  }

  calculatePredatorSeparation(currentBoid: Boid, boids: Boid[], separationRadius: number) {
    
    const separation = { x: 0, y: 0 };

    for (let otherBoid of boids) {
      if (otherBoid !== currentBoid) {
        const distance = this.calculateDistance(currentBoid.position, otherBoid.position);

        if (distance < separationRadius) {
          const diffX = currentBoid.position.x - otherBoid.position.x;
          const diffY = currentBoid.position.y - otherBoid.position.y;

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

    for (let otherBoid of boids) {
      if (otherBoid !== currentBoid) {
        const distance = this.calculateDistance(currentBoid.position, otherBoid.position);

        if (distance < this.alignmentRadius) {
          averageVelocity.x += otherBoid.velocity.x;
          averageVelocity.y += otherBoid.velocity.y;
          totalBoidsForVelocity++;
        }
        if (distance < this.cohesionRadius) {
          averagePosition.x += otherBoid.position.x;
          averagePosition.y += otherBoid.position.y;
          totalBoidsForDirection++;
        }
        if (distance < this.boidsSeparationRadius) {
          const diffX = currentBoid.position.x - otherBoid.position.x;
          const diffY = currentBoid.position.y - otherBoid.position.y;

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

  calculateDistance(point1: Point, point2: Point) {
    const diffX = point1.x - point2.x;
    const diffY = point1.y - point2.y;
    return Math.sqrt(diffX * diffX + diffY * diffY);
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
